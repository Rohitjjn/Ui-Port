package com.example.uiport.screenshots

import android.graphics.Rect
import androidx.compose.ui.semantics.SemanticsNode
import androidx.compose.ui.semantics.SemanticsProperties
import androidx.compose.ui.semantics.getOrNull
import androidx.compose.ui.test.junit4.ComposeContentTestRule
import androidx.compose.ui.test.onRoot
import androidx.compose.ui.unit.dp
import java.io.File
import org.json.JSONArray
import org.json.JSONObject

/**
 * Walks the semantics tree and writes the same shape the web capture produces:
 *
 *   { "text": "...", "role": "button", "testId": "play", "x": 16, "y": 24, "w": 40, "h": 40 }
 *
 * Coordinates are CSS pixels (dp), with the screen-density conversion done by Robolectric's
 * display metrics — the diff tool never converts anything itself.
 *
 * Copy next to [ScreenCaptureTest] and call `dumpSemantics(composeRule, path)` after capture.
 */
fun dumpSemantics(rule: ComposeContentTestRule, path: String) {
    val nodes = JSONArray()
    val root = rule.onRoot().fetchSemanticsNode()
    val density = rule.density.density

    fun walk(node: SemanticsNode) {
        val config = node.config
        val text = config.getOrNull(SemanticsProperties.Text)?.joinToString(" ") { it.text.trim() }
            ?: config.getOrNull(SemanticsProperties.ContentDescription)?.joinToString(" ")
        val testId = config.getOrNull(SemanticsProperties.TestTag)
        val role = config.getOrNull(SemanticsProperties.Role)?.toString()?.lowercase()
            ?: when {
                config.getOrNull(SemanticsProperties.OnClick) != null -> "button"
                config.getOrNull(SemanticsProperties.Heading) != null -> "heading"
                else -> "node"
            }
        val bounds = Rect()
        node.boundsInRoot.round(bounds)
        val w = bounds.width() / density
        val h = bounds.height() / density
        if ((text != null || testId != null) && w > 0f && h > 0f) {
            nodes.put(
                JSONObject()
                    .put("text", text)
                    .put("role", role)
                    .put("testId", testId)
                    .put("x", (bounds.left / density).toDouble())
                    .put("y", (bounds.top / density).toDouble())
                    .put("w", w.toDouble())
                    .put("h", h.toDouble()),
            )
        }
        node.children.forEach { walk(it) }
    }

    walk(root)
    val file = File(path)
    file.parentFile?.mkdirs()
    file.writeText(nodes.toString(2))
}

private val ComposeContentTestRule.density: androidx.compose.ui.unit.Density
    get() = runCatching { this.density as androidx.compose.ui.unit.Density }.getOrNull()
        ?: androidx.compose.ui.unit.Density(2f)
