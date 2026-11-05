package com.gopinath.kanal

import android.animation.ValueAnimator
import android.app.Activity
import android.content.Intent
import android.graphics.BitmapFactory
import android.graphics.Color
import android.graphics.PointF
import android.graphics.Typeface
import android.graphics.drawable.GradientDrawable
import android.opengl.Matrix
import android.os.Bundle
import android.os.Handler
import android.os.Looper
import android.util.Log
import android.view.Gravity
import android.view.MotionEvent
import android.view.View
import android.view.ViewGroup
import android.view.animation.DecelerateInterpolator
import android.widget.FrameLayout
import android.widget.ImageButton
import android.widget.TextView
import androidx.appcompat.app.AppCompatActivity
import androidx.core.view.ViewCompat
import androidx.core.view.WindowCompat
import androidx.core.view.WindowInsetsCompat
import com.google.ar.core.Anchor
import com.google.ar.core.Config
import com.google.ar.core.Frame
import com.google.ar.core.Plane
import com.google.ar.core.TrackingFailureReason
import com.google.ar.core.TrackingState
import com.google.ar.core.exceptions.UnavailableException
import io.github.sceneview.ar.ARSceneView
import io.github.sceneview.ar.node.AnchorNode
import io.github.sceneview.math.Rotation
import io.github.sceneview.math.Scale
import io.github.sceneview.node.ModelNode
import io.github.sceneview.node.Node
import org.json.JSONArray
import kotlin.math.atan2
import kotlin.math.cos
import kotlin.math.max
import kotlin.math.sin

/**
 * "View on your table" on Android: ARCore plane detection through SceneView, tap to set the dish down at real size,
 * then browse the menu on the table. The dish's name card floats above it with a leader line to a pin,
 * and the KANAL · MENU lockup with previous / pause / next lies flat on the table in front of it.
 * Pause stops the eight-second slideshow; pinch scales the dish, twist turns it; tapping the table again moves it.
 */
class TableArActivity : AppCompatActivity() {

    companion object {
        const val EXTRA_DISHES = "dishes"
        const val EXTRA_INDEX = "index"
        const val EXTRA_LOCKUP = "lockup"
        const val EXTRA_ERROR = "error"
        private const val TAG = "KanalAR"
        private const val ADVANCE_MS = 8000L
        // The lockup image is 1024 × 512 px and covers 30 × 15 cm of table.
        private const val LOCK_W = 0.30f
        private const val LOCK_D = 0.15f
        private val RINGS = floatArrayOf(0.30f, 0.50f, 0.70f) // ring centres across the image, at 70 % of its height
        private const val RING_V = 0.70f
    }

    data class Dish(val id: String, val name: String, val qty: String, val price: String, val model: String)

    private lateinit var dishes: List<Dish>
    private var index = 0
    private var paused = false
    private var userScale = 1f

    private lateinit var sceneView: ARSceneView
    private lateinit var overlay: TableOverlayView
    private lateinit var counter: TextView
    private lateinit var prevBtn: ImageButton
    private lateinit var pauseBtn: ImageButton
    private lateinit var nextBtn: ImageButton
    private var errorView: View? = null

    private var anchorNode: AnchorNode? = null
    private var contentNode: Node? = null
    private var modelNode: ModelNode? = null
    private var yaw = 0f
    private var dishHeight = 0.08f
    private var dishHalfDepth = 0.12f

    private val handler = Handler(Looper.getMainLooper())
    private val advance = Runnable { step(1) }
    private val lockupPrefix by lazy { intent.getStringExtra(EXTRA_LOCKUP) ?: "ar/lockup" }
    private val lockPause by lazy { BitmapFactory.decodeStream(assets.open("public/$lockupPrefix-pause.png")) }
    private val lockPlay by lazy { BitmapFactory.decodeStream(assets.open("public/$lockupPrefix-play.png")) }

    private val view = FloatArray(16)
    private val proj = FloatArray(16)
    private val vp = FloatArray(16)

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        WindowCompat.setDecorFitsSystemWindows(window, false)
        dishes = parseDishes(intent.getStringExtra(EXTRA_DISHES) ?: "[]")
        if (dishes.isEmpty()) { finishWith(Activity.RESULT_CANCELED, "No dishes"); return }
        index = intent.getIntExtra(EXTRA_INDEX, 0).coerceIn(0, dishes.size - 1)

        val serif = runCatching { Typeface.Builder(assets, "fonts/CormorantGaramond.ttf").setFontVariationSettings("'wght' 600").build() }.getOrDefault(Typeface.SERIF)
        val sans = runCatching { Typeface.createFromAsset(assets, "fonts/Lato-Regular.ttf") }.getOrDefault(Typeface.SANS_SERIF)
        val sansBold = runCatching { Typeface.createFromAsset(assets, "fonts/Lato-Bold.ttf") }.getOrDefault(Typeface.DEFAULT_BOLD)

        val root = FrameLayout(this).apply { setBackgroundColor(Color.BLACK) }
        sceneView = ARSceneView(this, sharedActivity = this, sharedLifecycle = lifecycle).apply {
            planeRenderer.isEnabled = true
            planeRenderer.isShadowReceiver = true
            configureSession { session, config ->
                config.planeFindingMode = Config.PlaneFindingMode.HORIZONTAL
                config.lightEstimationMode = Config.LightEstimationMode.ENVIRONMENTAL_HDR
                config.instantPlacementMode = Config.InstantPlacementMode.DISABLED
                config.depthMode = if (session.isDepthModeSupported(Config.DepthMode.AUTOMATIC)) Config.DepthMode.AUTOMATIC else Config.DepthMode.DISABLED
                config.focusMode = Config.FocusMode.AUTO
            }
            onSessionUpdated = { _, frame -> onFrame(frame) }
            onSessionFailed = { e -> showError(e) }
            onTrackingFailureChanged = { reason -> onTrackingFailure(reason) }
            setOnGestureListener(onSingleTapConfirmed = { e, _ -> onTap(e) })
        }
        root.addView(sceneView, FrameLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.MATCH_PARENT))

        overlay = TableOverlayView(this, serif, sans, sansBold).apply {
            coach = "Point at your table"; coachSub = "Move your phone slowly from side to side"
        }
        root.addView(overlay, FrameLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.MATCH_PARENT))

        // Top bar: close + counter.
        val top = FrameLayout(this)
        val close = roundButton(R.drawable.ic_ar_close, "Close the camera and go back to the menu") { finishWith(Activity.RESULT_OK) }
        top.addView(close, FrameLayout.LayoutParams(dp(48), dp(48), Gravity.START or Gravity.CENTER_VERTICAL))
        counter = TextView(this).apply {
            typeface = sansBold; textSize = 12f; letterSpacing = 0.14f; setTextColor(Color.rgb(233, 220, 198))
            setShadowLayer(4f, 0f, 1f, Color.BLACK); isAllCaps = true
        }
        top.addView(counter, FrameLayout.LayoutParams(ViewGroup.LayoutParams.WRAP_CONTENT, ViewGroup.LayoutParams.WRAP_CONTENT, Gravity.CENTER))
        root.addView(top, FrameLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, dp(64), Gravity.TOP).apply { leftMargin = dp(12); rightMargin = dp(12) })
        ViewCompat.setOnApplyWindowInsetsListener(top) { v, insets ->
            val bars = insets.getInsets(WindowInsetsCompat.Type.systemBars())
            (v.layoutParams as FrameLayout.LayoutParams).topMargin = bars.top + dp(4); v.requestLayout(); insets
        }

        // Real, accessible buttons that sit exactly on the rings drawn on the table.
        prevBtn = ghostButton("Previous dish") { step(-1) }
        pauseBtn = ghostButton("Pause the slideshow") { setPaused(!paused) }
        nextBtn = ghostButton("Next dish") { step(1) }
        listOf(prevBtn, pauseBtn, nextBtn).forEach { root.addView(it, FrameLayout.LayoutParams(dp(64), dp(64))) }

        setContentView(root)
        updateCounter()
        // System back (gesture or button) closes the camera and tells the menu which dish was showing.
        onBackPressedDispatcher.addCallback(this, object : androidx.activity.OnBackPressedCallback(true) {
            override fun handleOnBackPressed() = finishWith(Activity.RESULT_OK)
        })
    }

    // ---------- placement ----------
    private fun onTap(e: MotionEvent) {
        val hit = sceneView.hitTestAR(e.x, e.y, planeTypes = setOf(Plane.Type.HORIZONTAL_UPWARD_FACING)) ?: return
        val anchor = runCatching { hit.createAnchor() }.getOrNull() ?: return
        place(anchor)
    }

    private fun place(anchor: Anchor) {
        anchorNode?.let { sceneView.removeChildNode(it); it.destroy() }
        val a = AnchorNode(sceneView.engine, anchor)
        // Turn the arrangement to face the guest: local +z points from the dish towards the camera.
        val cam = sceneView.frame?.camera?.pose
        val p = anchor.pose
        yaw = if (cam != null) atan2(cam.tx() - p.tx(), cam.tz() - p.tz()) else 0f
        val content = Node(sceneView.engine).apply { rotation = Rotation(y = Math.toDegrees(yaw.toDouble()).toFloat()) }
        a.addChildNode(content)
        sceneView.addChildNode(a)
        anchorNode = a; contentNode = content
        val first = modelNode == null
        modelNode = null
        showDish(index, animate = !first)
        overlay.placed = true
        overlay.coach = ""
        if (first) setPaused(false)
    }

    private fun showDish(i: Int, animate: Boolean) {
        index = (i + dishes.size) % dishes.size
        val d = dishes[index]
        updateCounter()
        val content = contentNode ?: return
        val old = modelNode
        val node = runCatching {
            ModelNode(modelInstance = sceneView.modelLoader.createModelInstance("public/" + d.model), autoAnimate = false).apply {
                isEditable = true; isPositionEditable = false
                editableScaleRange = 0.4f..3f
                isShadowCaster = true
            }
        }.onFailure { Log.e(TAG, "model ${d.model}", it) }.getOrNull() ?: return
        dishHeight = max(0.02f, node.extents.y)
        dishHalfDepth = max(node.extents.x, node.extents.z) / 2f
        node.scale = Scale(if (animate) userScale * 0.85f else userScale)
        content.addChildNode(node)
        modelNode = node
        overlay.name = d.name
        overlay.meta = "${d.qty}  ·  ${d.price}"
        overlay.contentDescription = "${d.name}, ${d.qty}, ${d.price}"
        overlay.announceForAccessibility("${d.name}, ${d.qty}, ${d.price}")
        if (old != null) {
            ValueAnimator.ofFloat(1f, 0f).apply {
                duration = 180
                addUpdateListener { v -> old.scale = Scale(userScale * (0.85f + 0.15f * (v.animatedValue as Float))) }
                start()
            }
            handler.postDelayed({ content.removeChildNode(old); old.destroy() }, 190)
        }
        if (animate) {
            overlay.cardAlpha = 0f
            ValueAnimator.ofFloat(0f, 1f).apply {
                duration = 320; startDelay = 140; interpolator = DecelerateInterpolator()
                addUpdateListener { v -> val f = v.animatedValue as Float; node.scale = Scale(userScale * (0.85f + 0.15f * f)); overlay.cardAlpha = f }
                start()
            }
        }
    }

    private fun step(k: Int) {
        if (modelNode == null) { index = (index + k + dishes.size) % dishes.size; updateCounter(); return }
        modelNode?.let { userScale = it.scale.x.let { s -> if (s > 0f) s else 1f } }
        showDish(index + k, animate = true)
        reschedule()
    }

    private fun setPaused(p: Boolean) {
        paused = p
        overlay.lockup = if (p) lockPlay else lockPause
        pauseBtn.contentDescription = if (p) "Resume the slideshow" else "Pause the slideshow"
        reschedule()
    }

    private fun reschedule() {
        handler.removeCallbacks(advance)
        if (!paused && modelNode != null) handler.postDelayed(advance, ADVANCE_MS)
    }

    // ---------- every camera frame ----------
    private fun onFrame(frame: Frame) {
        val camera = frame.camera
        if (anchorNode == null) {
            if (camera.trackingState == TrackingState.TRACKING) {
                val found = sceneView.session?.getAllTrackables(Plane::class.java)?.any {
                    it.trackingState == TrackingState.TRACKING && it.type == Plane.Type.HORIZONTAL_UPWARD_FACING && it.subsumedBy == null
                } == true
                overlay.coach = if (found) "Tap the table to set the dish down" else "Point at your table"
                overlay.coachSub = if (found) "It appears at its real size" else "Move your phone slowly from side to side"
            }
            hideRingButtons()
            return
        }
        val a = anchorNode?.anchor ?: return
        if (a.trackingState != TrackingState.TRACKING) { hideRingButtons(); return }
        camera.getViewMatrix(view, 0)
        camera.getProjectionMatrix(proj, 0, 0.05f, 30f)
        Matrix.multiplyMM(vp, 0, proj, 0, view, 0)
        val p = a.pose
        val s = modelNode?.scale?.x ?: userScale
        val h = dishHeight * s
        // Card above the dish, pin on its top surface.
        overlay.cardAnchor = project(p.tx(), p.ty() + h + 0.10f, p.tz())
        overlay.pinPoint = project(p.tx(), p.ty() + h * 0.8f, p.tz())
        // Lockup rectangle on the table in front of the dish (towards the guest).
        val z0 = dishHalfDepth * s + 0.04f
        fun local(x: Float, z: Float): PointF? {
            val wx = p.tx() + x * cos(yaw) + z * sin(yaw)
            val wz = p.tz() - x * sin(yaw) + z * cos(yaw)
            return project(wx, p.ty() + 0.002f, wz)
        }
        val tl = local(-LOCK_W / 2, z0); val tr = local(LOCK_W / 2, z0)
        val br = local(LOCK_W / 2, z0 + LOCK_D); val bl = local(-LOCK_W / 2, z0 + LOCK_D)
        overlay.lockupQuad = if (tl != null && tr != null && br != null && bl != null) floatArrayOf(tl.x, tl.y, tr.x, tr.y, br.x, br.y, bl.x, bl.y) else null
        val btns = listOf(prevBtn, pauseBtn, nextBtn)
        RINGS.forEachIndexed { k, u ->
            val c = local(-LOCK_W / 2 + u * LOCK_W, z0 + RING_V * LOCK_D)
            val b = btns[k]
            if (c == null) { b.visibility = View.INVISIBLE } else {
                b.visibility = View.VISIBLE
                b.translationX = c.x - b.width / 2f; b.translationY = c.y - b.height / 2f
            }
        }
    }

    private fun hideRingButtons() { listOf(prevBtn, pauseBtn, nextBtn).forEach { it.visibility = View.INVISIBLE } }

    /** World point → screen pixels of the AR view, or null when it is behind the camera. */
    private fun project(x: Float, y: Float, z: Float): PointF? {
        val v = floatArrayOf(x, y, z, 1f); val o = FloatArray(4)
        Matrix.multiplyMV(o, 0, vp, 0, v, 0)
        if (o[3] <= 0.0001f) return null
        val nx = o[0] / o[3]; val ny = o[1] / o[3]
        return PointF((nx + 1f) / 2f * sceneView.width, (1f - ny) / 2f * sceneView.height)
    }

    private fun onTrackingFailure(reason: TrackingFailureReason?) {
        if (anchorNode != null) return
        overlay.coach = when (reason) {
            TrackingFailureReason.INSUFFICIENT_LIGHT -> "It’s a little dark here"
            TrackingFailureReason.EXCESSIVE_MOTION -> "Move a little more slowly"
            TrackingFailureReason.INSUFFICIENT_FEATURES -> "Point at the table’s surface"
            TrackingFailureReason.CAMERA_UNAVAILABLE -> "The camera is busy"
            else -> "Point at your table"
        }
    }

    private fun showError(e: Exception) {
        Log.e(TAG, "AR session failed", e)
        if (errorView != null) return
        val msg = if (e is UnavailableException) "This phone can’t place dishes on the table.\nYou can still turn every dish in 3D on the menu."
            else "The camera view couldn’t start on this phone.\nClose this screen to go back to the table preview."
        val box = TextView(this).apply {
            text = msg; textSize = 16f; setTextColor(Color.rgb(244, 236, 224)); setPadding(dp(24), dp(24), dp(24), dp(24))
            background = GradientDrawable().apply { setColor(Color.rgb(26, 20, 16)); cornerRadius = dp(16).toFloat(); setStroke(dp(1), Color.rgb(58, 47, 37)) }
            gravity = Gravity.CENTER
        }
        (window.decorView.findViewById<ViewGroup>(android.R.id.content).getChildAt(0) as FrameLayout)
            .addView(box, FrameLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.WRAP_CONTENT, Gravity.CENTER).apply { leftMargin = dp(24); rightMargin = dp(24) })
        errorView = box
        overlay.coach = ""
    }

    // ---------- helpers ----------
    private fun updateCounter() {
        counter.text = "${index + 1} / ${dishes.size}"
        counter.contentDescription = "Dish ${index + 1} of ${dishes.size}: ${dishes[index].name}"
    }

    private fun roundButton(icon: Int, label: String, onClick: () -> Unit) = ImageButton(this).apply {
        setImageResource(icon); contentDescription = label
        background = GradientDrawable().apply { shape = GradientDrawable.OVAL; setColor(Color.argb(110, 18, 14, 10)); setStroke(dp(1), Color.argb(160, 217, 189, 132)) }
        setOnClickListener { onClick() }
    }

    private fun ghostButton(label: String, onClick: () -> Unit) = ImageButton(this).apply {
        background = null; contentDescription = label; visibility = View.INVISIBLE
        setOnClickListener { onClick() }
    }

    private fun dp(v: Int) = (v * resources.displayMetrics.density).toInt()

    private fun parseDishes(json: String): List<Dish> = runCatching {
        val a = JSONArray(json)
        (0 until a.length()).map { k -> a.getJSONObject(k).let { o -> Dish(o.getString("id"), o.getString("name"), o.optString("qty"), o.optString("price"), o.getString("model")) } }
    }.getOrDefault(emptyList())

    private fun finishWith(code: Int, error: String? = null) {
        setResult(code, Intent().putExtra(EXTRA_INDEX, index).apply { if (error != null) putExtra(EXTRA_ERROR, error) })
        finish()
    }


    override fun onDestroy() { handler.removeCallbacksAndMessages(null); super.onDestroy() }
}
