package com.maxrave.simpmusic.ui.uiport

import androidx.compose.ui.Modifier
import androidx.compose.ui.layout.boundsInRoot
import androidx.compose.ui.layout.onGloballyPositioned
import kotlin.math.roundToInt

/**
 * Layout probe: what a screen *measured*, as opposed to what it looks like.
 *
 * The visual diff answers "how many pixels differ"; it cannot say which element moved.
 * The reference side already records exact boxes (`.geometry.json` from the web capture),
 * so the only missing half was the candidate's own boxes. This object collects them during
 * layout and the screenshot test prints them, which turns an iteration from "the card looks
 * high" into "the card starts at 283, the reference says 322, the difference is 39".
 *
 * It is deliberately inert: it records numbers and nothing else. It draws nothing, changes
 * no size, and is only read by tests, so it cannot mask a visual defect.
 */
object UiPortLayoutProbe {
    private val boxes = LinkedHashMap<String, String>()

    fun reset() {
        boxes.clear()
    }

    fun record(
        tag: String,
        x: Float,
        y: Float,
        w: Float,
        h: Float,
    ) {
        boxes[tag] = "x=${x.roundToInt()} y=${y.roundToInt()} ${w.roundToInt()}x${h.roundToInt()}"
    }

    /** One line per box, in the order the boxes were declared. */
    fun dump(): List<String> = boxes.map { (tag, box) -> "$tag $box" }

    /** Records the root-relative bounds of the node this modifier is applied to. */
    fun Modifier.layoutProbe(tag: String): Modifier =
        this.onGloballyPositioned { coordinates ->
            val bounds = coordinates.boundsInRoot()
            record(tag, bounds.left, bounds.top, bounds.width, bounds.height)
        }
}
