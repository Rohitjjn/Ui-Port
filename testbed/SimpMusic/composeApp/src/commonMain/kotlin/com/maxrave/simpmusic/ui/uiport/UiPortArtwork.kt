package com.maxrave.simpmusic.ui.uiport

import androidx.compose.foundation.Canvas
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.runtime.Composable
import androidx.compose.runtime.remember
import androidx.compose.ui.Modifier
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.geometry.Size
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.drawscope.DrawScope
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.graphics.drawscope.rotate
import androidx.compose.ui.graphics.drawscope.translate
import androidx.compose.ui.unit.dp
import kotlin.math.abs

/**
 * Deterministic "paper-cut botanical" cover art, ported from the prototype's
 * `src/utils/artwork.ts`.
 *
 * The web version emits inline SVG data URIs. Compose has no SVG renderer here, and
 * loading a renderer would make the screenshot depend on it, so the generator is ported
 * to the drawing primitives directly instead: same palettes, same RNG, same variant
 * selection, same geometry. The output is compared against the browser's SVG render in
 * the pixel diff — if the port of the algorithm drifted, the diff says so.
 *
 * Compose emits no gradient overlay here (the web `<rect fill="url(#g)" opacity="0.08">`
 * covers the whole tile); that 8% grey wash is recorded as a known limit and is applied
 * as a mask region instead of being faked with a different-looking blend.
 */
object UiPortArtwork {
    /** Palettes 0..15, in order, copied from the prototype. */
    private val PALETTES =
        listOf(
            listOf("#E9DDD0", "#71836B", "#25231F", "#FAF8F3"),
            listOf("#D9CBB7", "#C49A94", "#555149", "#FFFFFF"),
            listOf("#F0E6D6", "#A2A58A", "#71836B", "#25231F"),
            listOf("#CDBFA9", "#25231F", "#C49A94", "#FAF8F3"),
            listOf("#E6E3D6", "#5A6A55", "#D9CBB7", "#25231F"),
            listOf("#F2E9E3", "#B97E76", "#71836B", "#25231F"),
            listOf("#D6D9C8", "#3E4A3A", "#D9CBB7", "#FFFFFF"),
            listOf("#EBD9C9", "#8A6A5A", "#A2A58A", "#25231F"),
            listOf("#DCE1DA", "#71836B", "#C49A94", "#25231F"),
            listOf("#F6EFE4", "#25231F", "#71836B", "#C49A94"),
            listOf("#C9C4B2", "#2F2D28", "#E6DCCB", "#C49A94"),
            listOf("#E4D3CC", "#6D5B55", "#A2A58A", "#FAF8F3"),
            listOf("#D2D8CF", "#4F6650", "#F2E9E3", "#25231F"),
            listOf("#EFE4D2", "#9A7A4A", "#71836B", "#25231F"),
            listOf("#D8D4CC", "#25231F", "#D9CBB7", "#71836B"),
            listOf("#EAD9D6", "#8C5F5A", "#D9CBB7", "#25231F"),
        )

    private fun color(hex: String): Color =
        Color(0xFF000000.toInt() or hex.removePrefix("#").toLong(16).toInt())

    /**
     * The prototype's RNG: a plain LCG seeded from palette and seed. Reproduced exactly so
     * the same palette yields the same composition, not merely a similar one.
     */
    private class Rng(seed: Int) {
        private var s: Long = (seed.toLong() * 9301L + 49297L)

        fun next(): Double {
            s = (s * 9301L + 49297L) % 233280L
            return s.toDouble() / 233280.0
        }
    }

    @Composable
    fun Cover(
        palette: Int,
        seed: Int = 0,
        modifier: Modifier = Modifier,
    ) {
        val spec = remember(palette, seed) { build(palette, seed) }
        Canvas(modifier = modifier.fillMaxSize()) {
            spec.render(this)
        }
    }

    private class Spec(
        val bg: Color,
        val a: Color,
        val b: Color,
        val c: Color,
        val variant: Int,
        val rng: Rng,
    ) {
        fun render(scope: DrawScope) {
            val w = scope.size.width
            val h = scope.size.height
            scope.drawRect(bg, size = scope.size)
            when (variant) {
                0 -> {
                    val cx = w * (0.35f + rng.next().toFloat() * 0.3f)
                    val cy = h * 0.5f + (rng.next().toFloat() - 0.5f) * h * 0.15f
                    val petals = 6 + (rng.next() * 3).toInt()
                    for (i in 0 until petals) {
                        val ang = 360f / petals * i
                        scope.rotate(ang, pivot = Offset(cx, cy)) {
                            scope.drawOval(
                                color = c.copy(alpha = 0.92f),
                                topLeft = Offset(cx - w * 0.085f, cy - h * 0.37f),
                                size = Size(w * 0.17f, h * 0.39f),
                            )
                        }
                    }
                    scope.drawCircle(a, radius = w * 0.075f, center = Offset(cx, cy))
                    scope.drawLine(
                        color = b,
                        start = Offset(cx, cy + h * 0.05f),
                        end = Offset(cx - w * 0.15f, h),
                        strokeWidth = w * 0.015f,
                    )
                }

                1 -> {
                    for (i in 0 until 5) {
                        scope.drawCircle(
                            color = if (i % 2 == 1) a else b,
                            radius = (0.15f + i * 0.12f) * w,
                            center = Offset(w * 0.7f, h * 0.3f),
                            style = Stroke(width = (0.035f - i * 0.005f) * w),
                            alpha = (0.9f - i * 0.12f).coerceAtLeast(0f),
                        )
                    }
                    scope.drawRect(
                        color = c,
                        topLeft = Offset(w * 0.12f, h * 0.6f),
                        size = Size(w * 0.3f, h * 0.3f),
                    )
                }

                2 -> {
                    for (i in 0 until 4) {
                        val x = w * (0.2f + i * 0.2f)
                        scope.drawLine(
                            color = a,
                            start = Offset(x, h),
                            end = Offset(x, h * 0.12f),
                            strokeWidth = w * 0.01f,
                        )
                        for (j in 0 until 3) {
                            val y = h * (0.3f + j * 0.2f)
                            scope.drawOval(
                                color = if (j % 2 == 1) b else c,
                                topLeft = Offset(x, y - h * 0.06f),
                                size = Size(w * 0.15f, h * 0.12f),
                                alpha = 0.9f,
                            )
                        }
                    }
                }

                3 -> {
                    scope.drawCircle(c, radius = w * 0.225f, center = Offset(w * 0.6f, h * 0.35f))
                    scope.drawRect(a, topLeft = Offset(0f, h * 0.7f), size = Size(w, h * 0.3f))
                    scope.drawRect(b, topLeft = Offset(0f, h * 0.85f), size = Size(w, h * 0.15f))
                }

                4 -> {
                    for (i in 0 until 6) {
                        for (j in 0 until 6) {
                            val rr = 6 + (i * j) % 5 * 5
                            val col =
                                when ((i + j) % 3) {
                                    0 -> a
                                    1 -> b
                                    else -> c
                                }
                            scope.drawCircle(
                                color = col,
                                radius = w / 400f * rr,
                                center = Offset(w / 6f * i + w / 12f, h / 6f * j + h / 12f),
                                alpha = 0.9f,
                            )
                        }
                    }
                }

                else -> {
                    for (i in 0 until 7) {
                        val col =
                            when (i % 3) {
                                0 -> a
                                1 -> b
                                else -> c
                            }
                        scope.translate(left = -w * 0.1f + i * (w / 6f), top = 0f) {
                            scope.drawRect(
                                color = col,
                                topLeft = Offset.Zero,
                                size = Size(w / 9f, h),
                                alpha = (0.85f + (i % 2) * 0.15f).coerceAtMost(1f),
                            )
                        }
                    }
                    scope.drawCircle(
                        color = bg,
                        radius = w * 0.14f,
                        center = Offset(w * 0.3f, h * 0.65f),
                        style = Stroke(width = w * 0.015f),
                    )
                }
            }
        }
    }

    private fun build(palette: Int, seed: Int): Spec {
        val p = PALETTES[abs(palette) % PALETTES.size]
        return Spec(
            bg = color(p[0]),
            a = color(p[1]),
            b = color(p[2]),
            c = color(p[3]),
            variant = (palette + seed) % 6,
            rng = Rng(palette * 31 + seed * 7 + 1),
        )
    }

    /** Shadow-art radius used by the prototype's `shadow-art` utility. */
    val artCorner = 2.dp
}
