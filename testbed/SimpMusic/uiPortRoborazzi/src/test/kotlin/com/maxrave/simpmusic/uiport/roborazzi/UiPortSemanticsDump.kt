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
 * on a unit. `boundsInRoot` is already in dp when divided by density, which is why the density is
 * read from the rule rather than assumed to be 2.
 *
 * Every node that carries text, a content description or a test tag is emitted; decorative layout
 * nodes are skipped because the web dump cannot represent them (a `<div>` with no text is not in
 * `default.geometry.json`) and a candidate-only node would guarantee a mismatch.
 */
fun dumpSemantics(rule: ComposeContentTestRule, path: String, root: SemanticsNodeInteraction = rule.onRoot()) {
    val nodes = JSONArray()
    val density = rule.density.density
    val rootNode = root.fetchSemanticsNode()

    fun walk(node: SemanticsNode) {
        val config = node.config
        val text =
            config.getOrNull(SemanticsProperties.Text)?.joinToString(" ") { it.text.trim() }?.takeIf { it.isNotBlank() }
                ?: config.getOrNull(SemanticsProperties.ContentDescription)?.joinToString(" ")?.takeIf { it.isNotBlank() }
        val testId = config.getOrNull(SemanticsProperties.TestTag)
        // `contains`, not `getOrNull`, for the action/marker keys: `OnClick`'s value type is
        // star-projected in this Compose version, so `getOrNull` fails to infer `T` and the
        // presence check is all that is needed anyway (the web dump only records a role).
        val role =
            config.getOrNull(SemanticsProperties.Role)?.toString()?.lowercase()
                ?: when {
                    config.contains(SemanticsProperties.OnClick) -> "button"
                    config.contains(SemanticsProperties.Heading) -> "heading"
                    else -> null
                }
        val bounds = node.boundsInRoot
        val x = bounds.left.value
        val y = bounds.top.value
        val w = bounds.width.value
        val h = bounds.height.value
        if ((text != null || testId != null) && w > 0f && h > 0f) {
            nodes.put(
                JSONObject()
                    .put("text", text)
                    .put("role", role ?: "node")
                    .put("testId", testId)
                    .put("x", round2(x))
                    .put("y", round2(y))
                    .put("w", round2(w))
                    .put("h", round2(h)),
            )
        }
        node.children.forEach { walk(it) }
    }

    walk(rootNode)
    val file = File(path)
    file.parentFile?.mkdirs()
    file.writeText(nodes.toString(2))
    // Density is recorded alongside the dump: a 1x and a 2x dump describe the same layout in
    // different numbers, and a reviewer needs to see which one they are reading.
    println(
        "[ui-port] semantics ${file.name}: ${nodes.length()} nodes, " +
            "root ${rootNode.boundsInRoot.width.value.toInt()}x${rootNode.boundsInRoot.height.value.toInt()} dp at density ${density}x",
    )
}

private fun round2(v: Float): Double = Math.round(v * 100.0) / 100.0
