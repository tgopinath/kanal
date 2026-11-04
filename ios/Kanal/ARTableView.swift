import SwiftUI
import UIKit
import ARKit
import RealityKit
import Combine

/// SwiftUI wrapper for the table view.
struct ARTableScreen: UIViewControllerRepresentable {
    let request: ARRequest
    let onClose: (Int) -> Void
    func makeUIViewController(context: Context) -> ARTableViewController { ARTableViewController(request: request, onClose: onClose) }
    func updateUIViewController(_ vc: ARTableViewController, context: Context) {}
}

/// "View on your table" on iPhone.
/// - On a device with ARKit: horizontal-plane detection with Apple's coaching overlay, tap to set the dish down at real size.
/// - In the Simulator (no ARKit): the same scene in RealityKit's non-AR mode on a virtual walnut table, with a note that
///   AR needs a real iPhone, so the layout, models and controls can still be checked.
/// The floating glass card (Cormorant name, gold rule, weight · price) stays upright above the dish with a leader line to a pin;
/// the KANAL · MENU lockup and previous / pause / next lie flat on the table in front of it.
final class ARTableViewController: UIViewController {
    private let request: ARRequest
    private let onClose: (Int) -> Void
    private let isAR = ARWorldTrackingConfiguration.isSupported

    private var index: Int
    private var paused = false
    private var userScale: Float = 1

    private var arView: ARView!
    private var anchor: AnchorEntity?
    private var content = Entity()
    private var dish: ModelEntity?
    private var lockup: ModelEntity?
    private var dishHeight: Float = 0.08
    private var dishHalfDepth: Float = 0.12
    private var loading: AnyCancellable?
    private var updates: Cancellable?
    private var timer: Timer?
    private let lockTexPause = ARTableViewController.texture("ar/lockup-pause.png")
    private let lockTexPlay = ARTableViewController.texture("ar/lockup-play.png")

    // Overlay (UIKit, screen space)
    private let card = UIVisualEffectView(effect: UIBlurEffect(style: .systemUltraThinMaterialDark))
    private let nameLabel = UILabel()
    private let rule = CAGradientLayer()
    private let metaLabel = UILabel()
    private let leader = CAShapeLayer()
    private let pin = UIView()
    private let counter = UILabel()
    private let prevBtn = UIButton(type: .system), pauseBtn = UIButton(type: .system), nextBtn = UIButton(type: .system)
    private var coaching: ARCoachingOverlayView?
    private let hint = UILabel()

    // The lockup image is 1024 × 512 and covers 30 × 15 cm of table; rings at 30/50/70 % across, 70 % down.
    private let lockW: Float = 0.30, lockD: Float = 0.15
    private let rings: [Float] = [0.30, 0.50, 0.70], ringV: Float = 0.70

    init(request: ARRequest, onClose: @escaping (Int) -> Void) {
        self.request = request; self.onClose = onClose; self.index = request.index
        super.init(nibName: nil, bundle: nil)
        modalPresentationStyle = .fullScreen
    }
    required init?(coder: NSCoder) { fatalError() }

    override var preferredStatusBarStyle: UIStatusBarStyle { .lightContent }

    override func viewDidLoad() {
        super.viewDidLoad()
        view.backgroundColor = .black
        arView = ARView(frame: view.bounds, cameraMode: isAR ? .ar : .nonAR, automaticallyConfigureSession: false)
        arView.autoresizingMask = [.flexibleWidth, .flexibleHeight]
        view.addSubview(arView)
        buildOverlay()
        updates = arView.scene.subscribe(to: SceneEvents.Update.self) { [weak self] _ in self?.layoutOverlay() }
        if isAR { startAR() } else { startStudio() }
    }

    override func viewWillDisappear(_ animated: Bool) {
        super.viewWillDisappear(animated)
        timer?.invalidate()
        if isAR { arView.session.pause() }
    }

    // MARK: - AR (device)
    private func startAR() {
        let config = ARWorldTrackingConfiguration()
        config.planeDetection = [.horizontal]
        config.environmentTexturing = .automatic
        if ARWorldTrackingConfiguration.supportsFrameSemantics(.personSegmentationWithDepth) { config.frameSemantics.insert(.personSegmentationWithDepth) }
        arView.environment.sceneUnderstanding.options.insert(.receivesLighting)
        arView.session.run(config)

        let co = ARCoachingOverlayView()
        co.session = arView.session
        co.goal = .horizontalPlane
        co.activatesAutomatically = true
        co.frame = view.bounds; co.autoresizingMask = [.flexibleWidth, .flexibleHeight]
        view.insertSubview(co, aboveSubview: arView)
        coaching = co
        hint.text = "Tap the table to set the dish down"
        arView.addGestureRecognizer(UITapGestureRecognizer(target: self, action: #selector(tapped(_:))))
    }

    @objc private func tapped(_ g: UITapGestureRecognizer) {
        let p = g.location(in: arView)
        guard let hit = arView.raycast(from: p, allowing: .estimatedPlane, alignment: .horizontal).first else { return }
        let t = hit.worldTransform
        let pos = SIMD3<Float>(t.columns.3.x, t.columns.3.y, t.columns.3.z)
        let cam = arView.cameraTransform.translation
        place(at: pos, yaw: atan2(cam.x - pos.x, cam.z - pos.z))
    }

    // MARK: - Studio preview (Simulator)
    private func startStudio() {
        arView.environment.background = .color(Brand.walnut)
        // A walnut table top, lit like the restaurant.
        var wood = UnlitMaterial(color: UIColor(red: 0.42, green: 0.29, blue: 0.19, alpha: 1))
        if let tex = Self.texture("env/walnut.jpg") { wood.color = .init(tint: UIColor(white: 0.78, alpha: 1), texture: .init(tex)) }
        let table = ModelEntity(mesh: .generatePlane(width: 2.4, depth: 2.4), materials: [wood])
        let world = AnchorEntity(world: .zero)
        world.addChild(table)
        let key = DirectionalLight()
        key.light.intensity = 9000
        key.look(at: .zero, from: [0.4, 1, 0.7], relativeTo: nil)
        world.addChild(key)
        let fill = DirectionalLight()
        fill.light.intensity = 3500
        fill.light.color = UIColor(red: 1, green: 0.9, blue: 0.78, alpha: 1)
        fill.look(at: .zero, from: [-0.8, 0.6, 0.4], relativeTo: nil)
        world.addChild(fill)
        let camera = PerspectiveCamera()
        camera.camera.fieldOfViewInDegrees = 50
        camera.look(at: [0, 0.02, 0.16], from: [0, 0.78, 0.92], relativeTo: nil)
        world.addChild(camera)
        arView.scene.addAnchor(world)

        let banner = UILabel()
        banner.text = "AR needs a real iPhone. This is a studio preview of the table view."
        banner.font = Brand.sans(13, bold: true); banner.textColor = Brand.ink; banner.numberOfLines = 0; banner.textAlignment = .center
        banner.backgroundColor = UIColor(white: 0, alpha: 0.45); banner.layer.cornerRadius = 12; banner.clipsToBounds = true
        banner.translatesAutoresizingMaskIntoConstraints = false
        banner.accessibilityIdentifier = "ar-unavailable"
        view.addSubview(banner)
        NSLayoutConstraint.activate([
            banner.bottomAnchor.constraint(equalTo: view.safeAreaLayoutGuide.bottomAnchor, constant: -12),
            banner.leadingAnchor.constraint(equalTo: view.leadingAnchor, constant: 24),
            banner.trailingAnchor.constraint(equalTo: view.trailingAnchor, constant: -24),
            banner.heightAnchor.constraint(greaterThanOrEqualToConstant: 44),
        ])
        hint.text = ""
        place(at: .zero, yaw: 0, parent: world)
    }

    // MARK: - Content
    private func place(at pos: SIMD3<Float>, yaw: Float, parent: Entity? = nil) {
        coaching?.setActive(false, animated: true)
        let a: AnchorEntity
        if let parent = parent as? AnchorEntity { a = parent } else {
            anchor?.removeFromParent()
            a = AnchorEntity(world: pos)
            arView.scene.addAnchor(a)
        }
        anchor = a
        content.removeFromParent()
        content = Entity()
        content.orientation = simd_quatf(angle: yaw, axis: [0, 1, 0])
        a.addChild(content)
        let first = dish == nil
        dish = nil; lockup = nil
        showDish(index, animate: !first)
        hint.text = isAR ? "Pinch to resize · twist to turn · tap the table to move it" : ""
        if first { setPaused(false) }
    }

    private func showDish(_ i: Int, animate: Bool) {
        index = (i + request.dishes.count) % request.dishes.count
        let d = request.dishes[index]
        counter.text = "\(index + 1) / \(request.dishes.count)"
        counter.accessibilityLabel = "Dish \(index + 1) of \(request.dishes.count)"
        UIView.animate(withDuration: animate ? 0.18 : 0) { self.card.alpha = 0; self.leader.opacity = 0; self.pin.alpha = 0 }
        guard let url = Bundle.main.resourceURL?.appendingPathComponent("web").appendingPathComponent(d.usdz) else { return }
        let old = dish
        if let old { old.move(to: Transform(scale: .init(repeating: userScale * 0.85), rotation: old.orientation, translation: old.position), relativeTo: old.parent, duration: 0.18) }
        loading = ModelEntity.loadModelAsync(contentsOf: url).sink(receiveCompletion: { c in
            if case .failure(let e) = c { print("Kanal: model \(d.usdz) failed: \(e)") }
        }, receiveValue: { [weak self] model in
            guard let self else { return }
            old?.removeFromParent()
            let b = model.visualBounds(relativeTo: nil)
            self.dishHeight = max(0.02, b.extents.y)
            self.dishHalfDepth = max(b.extents.x, b.extents.z) / 2
            model.generateCollisionShapes(recursive: true)
            model.scale = .init(repeating: animate ? self.userScale * 0.85 : self.userScale)
            self.content.addChild(model)
            if self.isAR { self.arView.installGestures([.rotation, .scale], for: model) }
            if animate { model.move(to: Transform(scale: .init(repeating: self.userScale), rotation: model.orientation, translation: model.position), relativeTo: self.content, duration: 0.32, timingFunction: .easeOut) }
            self.dish = model
            self.placeLockup()
            self.nameLabel.text = d.name
            self.metaLabel.text = "\(d.qty)  ·  \(d.price)"
            self.card.accessibilityLabel = "\(d.name), \(d.qty), \(d.price)"
            UIAccessibility.post(notification: .announcement, argument: "\(d.name), \(d.qty), \(d.price)")
            UIView.animate(withDuration: 0.32, delay: 0.1) { self.card.alpha = 1; self.pin.alpha = 1 }
            self.leader.opacity = 1
        })
    }

    private func placeLockup() {
        let s = dish?.scale.x ?? userScale
        let z0 = dishHalfDepth * s + 0.04
        if lockup == nil {
            let l = ModelEntity(mesh: .generatePlane(width: lockW, depth: lockD), materials: [lockMaterial()])
            content.addChild(l)
            lockup = l
        }
        lockup?.position = [0, 0.002, z0 + lockD / 2]
    }

    private func lockMaterial() -> UnlitMaterial {
        var m = UnlitMaterial()
        if let t = paused ? lockTexPlay : lockTexPause {
            m.color = .init(tint: UIColor(white: 1, alpha: 0.999), texture: .init(t))
            m.blending = .transparent(opacity: .init(floatLiteral: 1))
        }
        return m
    }

    private func step(_ k: Int) {
        if let d = dish { userScale = d.scale.x > 0 ? d.scale.x : 1 }
        showDish(index + k, animate: true)
        reschedule()
    }

    private func setPaused(_ p: Bool) {
        paused = p
        lockup?.model?.materials = [lockMaterial()]
        pauseBtn.accessibilityLabel = p ? "Resume the slideshow" : "Pause the slideshow"
        reschedule()
    }

    private func reschedule() {
        timer?.invalidate()
        guard !paused else { return }
        timer = Timer.scheduledTimer(withTimeInterval: 8, repeats: false) { [weak self] _ in self?.step(1) }
    }

    /// Loads an image from the bundled web app (web/<path>) as a RealityKit texture.
    private static func texture(_ path: String) -> TextureResource? {
        guard let url = Bundle.main.resourceURL?.appendingPathComponent("web/" + path),
              let img = UIImage(contentsOfFile: url.path)?.cgImage else { return nil }
        return try? TextureResource.generate(from: img, options: .init(semantic: .color))
    }

    // MARK: - Overlay
    private func buildOverlay() {
        // Leader line + pin
        leader.strokeColor = Brand.goldLight.withAlphaComponent(0.8).cgColor
        leader.lineWidth = 1.25; leader.lineCap = .round; leader.fillColor = nil
        view.layer.addSublayer(leader)
        pin.frame = CGRect(x: 0, y: 0, width: 10, height: 10)
        pin.backgroundColor = UIColor(red: 1, green: 0.953, blue: 0.84, alpha: 1)
        pin.layer.cornerRadius = 5
        pin.layer.shadowColor = UIColor(red: 0.96, green: 0.816, blue: 0.54, alpha: 1).cgColor
        pin.layer.shadowRadius = 9; pin.layer.shadowOpacity = 0.9; pin.layer.shadowOffset = .zero
        pin.isAccessibilityElement = false
        view.addSubview(pin)
        let pulse = CABasicAnimation(keyPath: "shadowRadius"); pulse.fromValue = 7; pulse.toValue = 14; pulse.duration = 1.2; pulse.autoreverses = true; pulse.repeatCount = .infinity
        pin.layer.add(pulse, forKey: "pulse")

        // Frosted card
        card.layer.cornerRadius = 16; card.clipsToBounds = true
        card.layer.borderColor = UIColor(white: 1, alpha: 0.18).cgColor; card.layer.borderWidth = 1
        card.isAccessibilityElement = true; card.accessibilityTraits = .staticText
        nameLabel.font = Brand.serif(26); nameLabel.textColor = Brand.ink; nameLabel.textAlignment = .center; nameLabel.numberOfLines = 2
        metaLabel.font = Brand.sans(14); metaLabel.textColor = UIColor(red: 0.918, green: 0.847, blue: 0.706, alpha: 1); metaLabel.textAlignment = .center
        rule.colors = [UIColor.clear.cgColor, Brand.gold.cgColor, UIColor.clear.cgColor]
        rule.startPoint = CGPoint(x: 0, y: 0.5); rule.endPoint = CGPoint(x: 1, y: 0.5)
        card.contentView.addSubview(nameLabel); card.contentView.addSubview(metaLabel); card.contentView.layer.addSublayer(rule)
        card.alpha = 0
        view.addSubview(card)

        // Top bar
        let close = UIButton(type: .system)
        close.setImage(UIImage(systemName: "xmark", withConfiguration: UIImage.SymbolConfiguration(pointSize: 17, weight: .regular)), for: .normal)
        close.tintColor = UIColor(red: 0.945, green: 0.886, blue: 0.769, alpha: 1)
        close.backgroundColor = UIColor(white: 0, alpha: 0.35)
        close.layer.cornerRadius = 24; close.layer.borderWidth = 1; close.layer.borderColor = Brand.gold.withAlphaComponent(0.6).cgColor
        close.accessibilityLabel = "Close the camera and go back to the menu"
        close.addAction(UIAction { [weak self] _ in self?.close() }, for: .touchUpInside)
        counter.font = Brand.sans(12, bold: true); counter.textColor = UIColor(red: 0.914, green: 0.863, blue: 0.776, alpha: 1)
        for v in [close, counter] as [UIView] { v.translatesAutoresizingMaskIntoConstraints = false; view.addSubview(v) }
        hint.font = Brand.sans(13); hint.textColor = UIColor(red: 0.804, green: 0.749, blue: 0.671, alpha: 1); hint.textAlignment = .center
        hint.translatesAutoresizingMaskIntoConstraints = false; view.addSubview(hint)
        NSLayoutConstraint.activate([
            close.leadingAnchor.constraint(equalTo: view.leadingAnchor, constant: 16),
            close.topAnchor.constraint(equalTo: view.safeAreaLayoutGuide.topAnchor, constant: 4),
            close.widthAnchor.constraint(equalToConstant: 48), close.heightAnchor.constraint(equalToConstant: 48),
            counter.centerXAnchor.constraint(equalTo: view.centerXAnchor),
            counter.centerYAnchor.constraint(equalTo: close.centerYAnchor),
            hint.centerXAnchor.constraint(equalTo: view.centerXAnchor),
            hint.bottomAnchor.constraint(equalTo: view.safeAreaLayoutGuide.bottomAnchor, constant: -8),
        ])

        // Accessible buttons placed over the rings drawn on the table, every frame.
        for (b, label, act) in [(prevBtn, "Previous dish", { [weak self] in self?.step(-1) }),
                                (pauseBtn, "Pause the slideshow", { [weak self] in guard let self else { return }; self.setPaused(!self.paused) }),
                                (nextBtn, "Next dish", { [weak self] in self?.step(1) })] as [(UIButton, String, () -> Void)] {
            b.frame = CGRect(x: 0, y: 0, width: 60, height: 60)
            b.accessibilityLabel = label
            b.isHidden = true
            b.addAction(UIAction { _ in act() }, for: .touchUpInside)
            view.addSubview(b)
        }
    }

    private func world(_ local: SIMD3<Float>) -> SIMD3<Float> { content.convert(position: local, to: nil) }

    private func layoutOverlay() {
        guard let dish, lockup != nil else { [prevBtn, pauseBtn, nextBtn].forEach { $0.isHidden = true }; return }
        let s = dish.scale.x
        let h = dishHeight * s
        let top = arView.project(world([0, h + 0.10, 0]))
        let pinP = arView.project(world([0, h * 0.8, 0]))
        // Card: centred above the dish, kept on screen.
        let maxW = min(view.bounds.width * 0.84, 340)
        let nameSize = nameLabel.sizeThatFits(CGSize(width: maxW - 40, height: 200))
        let w = max(220, min(maxW, max(nameSize.width, metaLabel.intrinsicContentSize.width) + 40))
        let hgt = 14 + nameSize.height + 18 + 20 + 14
        if let top {
            var x = top.x - w / 2, y = top.y - 18 - hgt
            x = min(max(12, x), view.bounds.width - w - 12)
            y = min(max(view.safeAreaInsets.top + 64, y), view.bounds.height - hgt - 12)
            card.frame = CGRect(x: x, y: y, width: w, height: hgt)
            nameLabel.frame = CGRect(x: 20, y: 14, width: w - 40, height: nameSize.height)
            rule.frame = CGRect(x: w / 2 - 28, y: nameLabel.frame.maxY + 9, width: 56, height: 1)
            metaLabel.frame = CGRect(x: 12, y: rule.frame.maxY + 8, width: w - 24, height: 20)
        }
        if let pinP {
            pin.center = pinP
            let path = UIBezierPath(); path.move(to: CGPoint(x: card.frame.midX, y: card.frame.maxY)); path.addLine(to: CGPoint(x: pinP.x, y: pinP.y - 7))
            CATransaction.begin(); CATransaction.setDisableActions(true); leader.path = path.cgPath; CATransaction.commit()
        }
        // Ring buttons on the table.
        let z0 = dishHalfDepth * s + 0.04
        for (k, b) in [prevBtn, pauseBtn, nextBtn].enumerated() {
            let local = SIMD3<Float>(-lockW / 2 + rings[k] * lockW, 0.002, z0 + ringV * lockD)
            if let p = arView.project(world(local)) { b.isHidden = false; b.center = p } else { b.isHidden = true }
        }
        lockup?.position = [0, 0.002, z0 + lockD / 2]
    }

    private func close() {
        timer?.invalidate()
        onClose(index)
    }
}
