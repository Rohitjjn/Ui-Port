package com.maxrave.simpmusic.uiport.roborazzi

import androidx.compose.ui.semantics.SemanticsNode
import androidx.compose.ui.semantics.SemanticsProperties
import androidx.compose.ui.semantics.getOrNull
import androidx.compose.ui.test.SemanticsNodeInteraction
import androidx.compose.ui.test.junit4.ComposeContentTestRule
import androidx.compose.ui.test.onRoot
import java.io.File
import org.json.JSONArray
import org.json.JSONObject

/**
 * Writes the candidate half of the geometry gate: the same shape the web capture produces.
 *
 *   { "text": "...", "role": "button", "testId": "play", "x": 16, "y": 24, "w": 40, "h": 40 }
 *
 * Coordinates are **dp**, not device pixels, and the conversion is explicit (`Density`), because
 * the web side measures CSS pixels and the whole point of the comparison is that both sides agree
 * on a unit. `boundsInRoot` reports device pixels, so each box is divided by the rule's density
 * once, here — which is why the density is read from the rule rather than assumed to be 2.
 *
 * Every node that carries text, a content description or a test tag is emitted; decorative layout
 * nodes are skipped because the web dump cannot represent them (a `<div>` with no text is not in
 * `default.geometry.json`) and a candidate-only node would guarantee a mismatch.
 */
fun dumpSemantics(
    rule: ComposeContentTestRule,
    path: String,
    // `useUnmergedTree = true` is not a detail: the merged tree folds a row's texts into the
    // clickable row that owns them, so a screen with 165 text runs reported 16 nodes and the
    // geometry coverage was 0% against a DOM dump that lists every element. The DOM does not
    // merge, so the semantics dump must not either.
    root: SemanticsNodeInteraction = rule.onRoot(useUnmergedTree = true),
) {
    val nodes = JSONArray()
    val density = rule.density.density
    val rootNode = root.fetchSemanticsNode()

    fun walk(
        node: SemanticsNode,
        ancestors: List<JSONObject> = emptyList(),
    ) {
        val config = node.config
        val text =
            config.getOrNull(SemanticsProperties.Text)?.joinToString(" ") { it.text.trim() }?.takeIf { it.isNotBlank() }
                ?: config.getOrNull(SemanticsProperties.ContentDescription)?.joinToString(" ")?.takeIf { it.isNotBlank() }
        val testId = config.getOrNull(SemanticsProperties.TestTag)
        // Presence of the action/marker keys is read by iterating the configuration, not with
        // `getOrNull`/`contains`: both are generic in the key's value type, and `OnClick` is
        // star-projected in this Compose version, so the inference fails at compile time. The
        // web dump records only a role, so presence is all that is needed.
        val keyNames = config.map { it.key.name }.toSet()
        val role =
            config.getOrNull(SemanticsProperties.Role)?.toString()?.lowercase()
                ?: when {
                    keyNames.contains("OnClick") -> "button"
                    keyNames.contains("Heading") -> "heading"
                    else -> null
                }
        // `boundsInRoot` is a Rect in **device pixels**; the web dump is in CSS pixels (= dp at
        // this viewport). Dividing here, once, is what makes the two dumps comparable, and it is
        // why the density is read from the rule instead of assumed.
        val bounds = node.boundsInRoot
        val x = bounds.left / density
        val y = bounds.top / density
        val w = bounds.width / density
        val h = bounds.height / density
        if ((text != null || testId != null) && w > 0f && h > 0f) {
            nodes.put(
                JSONObject()
                    .put("text", text)
                    .put("role", role ?: "node")
                    .put("testId", testId)
                    .put("x", round2(x))
                    .put("y", round2(y))
                    .put("w", round2(w))
                    .put("h", round2(h))
                    // The boxes of the enclosing nodes, smallest first. Not decoration: in the
                    // DOM a nav label is a bare text node inside the `<a>`, so the reference's
                    // canonical box for "Home" is the whole 64x66 link, while Compose's is the
                    // 16 dp `Text`. Without the ancestors the comparator reports a 38 dp "shift"
                    // for a label that is exactly where the prototype puts it.
                    .put("ancestors", JSONArray(ancestors.take(3))),
            )
        }
        // Only boxes that carry text or a click survive into the ancestor list: a pure layout
        // Row is not something the web dump can name, so it would match anything.
        val box =
            JSONObject()
                .put("x", round2(x))
                .put("y", round2(y))
                .put("w", round2(w))
                .put("h", round2(h))
        val carriesMeaning =
            testId != null || keyNames.contains("OnClick") || (text != null && text.isNotBlank())
        val next = if (carriesMeaning) listOf(box) + ancestors else ancestors
        node.children.forEach { walk(it, next) }
    }

    walk(rootNode)
    val file = File(path)
    file.parentFile?.mkdirs()
    file.writeText(nodes.toString(2))
    // Density is recorded alongside the dump: a 1x and a 2x dump describe the same layout in
    // different numbers, and a reviewer needs to see which one they are reading.
    println(
        "[ui-port] semantics ${file.name}: ${nodes.length()} nodes, " +
            "root ${(rootNode.boundsInRoot.width / density).toInt()}x${(rootNode.boundsInRoot.height / density).toInt()} dp " +
            "at density ${density}x",
    )
}

private fun round2(v: Float): Double = Math.round(v * 100.0) / 100.0
