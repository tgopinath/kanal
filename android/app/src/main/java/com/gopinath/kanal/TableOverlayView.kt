package com.gopinath.kanal

import android.content.Context
import android.graphics.Bitmap
import android.graphics.Canvas
import android.graphics.Color
import android.graphics.LinearGradient
import android.graphics.Matrix
import android.graphics.Paint
import android.graphics.PointF
import android.graphics.RadialGradient
import android.graphics.RectF
import android.graphics.Shader
import android.graphics.Typeface
import android.text.Layout
import android.text.StaticLayout
import android.text.TextPaint
import android.view.View
import kotlin.math.max
import kotlin.math.min
import kotlin.math.sin

/**
 * Everything Kanal draws over the camera, in screen space, from points the activity projects every frame:
 * - the KANAL · MENU lockup with the three ring controls, warped with a perspective matrix so it lies flat on the table
 * - the frosted card (dish name in Cormorant, gold rule, "280 g · ₹1,450"), kept upright and readable (billboarded)
 * - the thin leader line from the card down to a softly pulsing pin on the dish
 * - the coaching panel before the dish is placed.
 * It never takes touches itself; the real (accessible) buttons sit on top of the drawn rings.
 */
class TableOverlayView(context: Context, private val serif: Typeface, private val sans: Typeface, private val sansBold: Typeface) : View(context) {

    // ---- state set by the activity ----
    var placed = false
    var coach: String = ""          // text of the coaching panel ("" hides it)
    var coachSub: String = ""
    var name = ""
    var meta = ""
    var cardAlpha = 1f
    var cardAnchor: PointF? = null  // screen point the card sits above
    var pinPoint: PointF? = null    // screen point of the pin on the dish
    var lockupQuad: FloatArray? = null // 8 floats: TL, TR, BR, BL of the lockup image on screen
    var lockup: Bitmap? = null

    private val d = resources.displayMetrics.density
    private val sp = resources.displayMetrics.scaledDensity

    private val cardFill = Paint(Paint.ANTI_ALIAS_FLAG).apply { color = Color.argb(150, 24, 17, 11) }
    private val cardSheen = Paint(Paint.ANTI_ALIAS_FLAG)
    private val cardStroke = Paint(Paint.ANTI_ALIAS_FLAG).apply { style = Paint.Style.STROKE; strokeWidth = 1f * d; color = Color.argb(90, 255, 244, 220) }
    private val namePaint = TextPaint(Paint.ANTI_ALIAS_FLAG).apply { typeface = serif; textSize = 25f * sp; color = Color.rgb(251, 244, 232) }
    private val metaPaint = TextPaint(Paint.ANTI_ALIAS_FLAG).apply { typeface = sans; textSize = 14f * sp; color = Color.rgb(234, 216, 180); letterSpacing = 0.04f; textAlign = Paint.Align.CENTER }
    private val rulePaint = Paint(Paint.ANTI_ALIAS_FLAG).apply { strokeWidth = 1f * d }
    private val linePaint = Paint(Paint.ANTI_ALIAS_FLAG).apply { strokeWidth = 1.25f * d; color = Color.argb(205, 232, 211, 166); strokeCap = Paint.Cap.ROUND }
    private val pinCore = Paint(Paint.ANTI_ALIAS_FLAG).apply { color = Color.rgb(255, 243, 214) }
    private val pinGlow = Paint(Paint.ANTI_ALIAS_FLAG)
    private val bmpPaint = Paint(Paint.ANTI_ALIAS_FLAG or Paint.FILTER_BITMAP_FLAG)
    private val coachFill = Paint(Paint.ANTI_ALIAS_FLAG).apply { color = Color.argb(170, 18, 14, 10) }
    private val coachTitle = TextPaint(Paint.ANTI_ALIAS_FLAG).apply { typeface = sansBold; textSize = 16f * sp; color = Color.rgb(244, 236, 224); textAlign = Paint.Align.CENTER }
    private val coachText = TextPaint(Paint.ANTI_ALIAS_FLAG).apply { typeface = sans; textSize = 14f * sp; color = Color.rgb(205, 191, 171); textAlign = Paint.Align.CENTER }
    private val ringPaint = Paint(Paint.ANTI_ALIAS_FLAG).apply { style = Paint.Style.STROKE; strokeWidth = 1.5f * d; color = Color.argb(220, 232, 211, 166) }
    private val m = Matrix()
    private val rect = RectF()
    private val t0 = System.nanoTime()

    init { setWillNotDraw(false); isClickable = false; isFocusable = false; importantForAccessibility = IMPORTANT_FOR_ACCESSIBILITY_NO }

    override fun onDraw(c: Canvas) {
        val t = (System.nanoTime() - t0) / 1e9f
        if (placed) {
            drawLockup(c)
            drawLeaderAndPin(c, t)
            drawCard(c)
        }
        if (coach.isNotEmpty()) drawCoach(c, t)
        postInvalidateOnAnimation()
    }

    private fun drawLockup(c: Canvas) {
        val q = lockupQuad ?: return
        val b = lockup ?: return
        val w = b.width.toFloat(); val h = b.height.toFloat()
        if (!m.setPolyToPoly(floatArrayOf(0f, 0f, w, 0f, w, h, 0f, h), 0, q, 0, 4)) return
        c.save(); c.concat(m); c.drawBitmap(b, 0f, 0f, bmpPaint); c.restore()
    }

    private var cardRect = RectF()

    private fun drawCard(c: Canvas) {
        val a = cardAnchor ?: return
        if (name.isEmpty()) return
        val pad = 20f * d
        val maxW = min(width * 0.84f, 340f * d)
        val nameW = min(maxW - 2 * pad, namePaint.measureText(name) + 1)
        val layout = StaticLayout.Builder.obtain(name, 0, name.length, namePaint, max(1, nameW.toInt()))
            .setAlignment(Layout.Alignment.ALIGN_CENTER).setMaxLines(2).setLineSpacing(0f, 0.95f).build()
        val cw = max(220f * d, max(layout.width.toFloat(), metaPaint.measureText(meta)) + 2 * pad)
        val ch = 14f * d + layout.height + 18f * d + metaPaint.textSize + 16f * d
        // Card bottom sits 18 dp above the anchor; kept fully on screen.
        val gap = 18f * d
        var left = a.x - cw / 2; var top = a.y - gap - ch
        left = left.coerceIn(12f * d, width - cw - 12f * d)
        top = top.coerceIn(96f * d, height - ch - 12f * d)
        cardRect.set(left, top, left + cw, top + ch)
        val alpha = (cardAlpha * 255).toInt().coerceIn(0, 255)
        val r = 16f * d
        cardFill.alpha = (150 * cardAlpha).toInt()
        c.drawRoundRect(cardRect, r, r, cardFill)
        cardSheen.shader = LinearGradient(0f, top, 0f, top + ch, Color.argb((40 * cardAlpha).toInt(), 255, 255, 255), Color.argb((8 * cardAlpha).toInt(), 255, 255, 255), Shader.TileMode.CLAMP)
        c.drawRoundRect(cardRect, r, r, cardSheen)
        cardStroke.alpha = (90 * cardAlpha).toInt()
        c.drawRoundRect(cardRect, r, r, cardStroke)
        namePaint.alpha = alpha
        c.save(); c.translate(left + (cw - layout.width) / 2, top + 14f * d); layout.draw(c); c.restore()
        val ry = top + 14f * d + layout.height + 9f * d
        rulePaint.shader = LinearGradient(left + cw / 2 - 28f * d, 0f, left + cw / 2 + 28f * d, 0f,
            intArrayOf(Color.TRANSPARENT, Color.argb(alpha, 217, 189, 132), Color.TRANSPARENT), null, Shader.TileMode.CLAMP)
        c.drawLine(left + cw / 2 - 28f * d, ry, left + cw / 2 + 28f * d, ry, rulePaint)
        metaPaint.alpha = alpha
        c.drawText(meta, left + cw / 2, ry + 9f * d + metaPaint.textSize * 0.85f, metaPaint)
    }

    private fun drawLeaderAndPin(c: Canvas, t: Float) {
        val p = pinPoint ?: return
        if (cardAnchor == null) return
        val x1 = cardRect.centerX(); val y1 = cardRect.bottom
        if (!cardRect.isEmpty && cardAlpha > 0.05f) {
            linePaint.alpha = (205 * cardAlpha).toInt()
            c.drawLine(x1, y1, p.x, p.y - 7f * d, linePaint)
        }
        val pulse = 0.5f + 0.5f * sin(t * 2.6f)
        val gr = (16f + 6f * pulse) * d
        pinGlow.shader = RadialGradient(p.x, p.y, gr, intArrayOf(Color.argb((150 * cardAlpha).toInt(), 245, 208, 138), Color.TRANSPARENT), null, Shader.TileMode.CLAMP)
        c.drawCircle(p.x, p.y, gr, pinGlow)
        pinCore.alpha = (255 * cardAlpha).toInt()
        c.drawCircle(p.x, p.y, 5f * d, pinCore)
    }

    private fun drawCoach(c: Canvas, t: Float) {
        val cx = width / 2f
        val cy = height * 0.62f
        // A ring that drifts left and right: "move the phone slowly".
        val dx = sin(t * 1.6f) * 28f * d
        ringPaint.alpha = 220
        c.drawCircle(cx + dx, cy - 70f * d, 22f * d, ringPaint)
        c.drawCircle(cx + dx, cy - 70f * d, 3f * d, pinCore.apply { alpha = 255 })
        val w = min(width - 48f * d, 320f * d)
        rect.set(cx - w / 2, cy - 22f * d, cx + w / 2, cy + 50f * d)
        c.drawRoundRect(rect, 16f * d, 16f * d, coachFill)
        c.drawText(coach, cx, cy + 6f * d, coachTitle)
        if (coachSub.isNotEmpty()) c.drawText(coachSub, cx, cy + 30f * d, coachText)
    }
}
