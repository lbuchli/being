"use strict";
/**
 * Spline editor custom HTML element.
 */
import { BBox } from "/static/js/bbox.js";
import { CurverBase } from "/static/js/curver.js";
import { make_draggable } from "/static/js/draggable.js";
import { History } from "/static/js/history.js";
import { subtract_arrays, clip } from "/static/js/math.js";
import { BPoly } from "/static/js/spline.js";
import { fetch_json } from "/static/js/utils.js";
import { Line } from "/static/js/line.js";
import { Transport } from "/static/js/transport.js";
import { SplineDrawer } from "/static/js/spline_drawer.js";
import { SplineList } from "/static/js/spline_list.js";
import { HTTP_HOST } from "/static/js/constants.js";
import { MotorSelector } from "/static/js/motor_selector.js";
import { toggle_button, switch_button_on, switch_button_off, is_checked } from "/static/js/button.js";


/** Main loop interval of being block network. */
const INTERVAL = 0.010;

/** Zero spline with duration 1.0 */
const ZERO_SPLINE = new BPoly([
    [0.],
    [0.],
    [0.],
    [0.],
], [0., 1.]);

/** Magnification factor for one single click on the zoom buttons */
const ZOOM_FACTOR_PER_STEP = 1.5;

/** Default data bbox size. */
const DEFAULT_DATA_BBOX = new BBox([0, 0], [1, 0.04]);


/**
 * Zoom / scale bounding box in place.
 *
 * @param {Bbox} bbox Bounding box to scale.
 * @param {Number} factor Zoom factor.
 */
function zoom_bbox_in_place(bbox, factor) {
    const mid = .5 * (bbox.left + bbox.right);
    bbox.left = 1 / factor * (bbox.left - mid) + mid;
    bbox.right = 1 / factor * (bbox.right - mid) + mid;
}


/**
 * Spline editor.
 *
 * Shadow root with canvas and SVG overlay.
 */
class Editor extends CurverBase {
    constructor() {
        const auto = false;
        super(auto);
        this.history = new History();
        this.dataBbox = DEFAULT_DATA_BBOX.copy();
        this.transport = new Transport(this);
        this.drawer = new SplineDrawer(this, this.splineGroup);
        this.backgroundDrawer = new SplineDrawer(this, this.backgroundGroup);
        this.motorSelector = null;  // Gets initialized inside setup_toolbar_elements(). Not nice but...
        this.splineList = new SplineList(this);
        this.splineList.add_spline_list()
        this.splineList.fetch_splines().then(() =>
            this.splineList.update_spline_list()
        )

        // Single actual value line
        const color = this.colorPicker.next();
        this.line = new Line(this.ctx, color, this.maxlen);
        this.lines.push(this.line);

        this.setup_toolbar_elements();

        // SVG event listeners
        this.setup_svg_drag_navigation();
        this.svg.addEventListener("click", evt => {
            this.lines.forEach(line => {
                line.data.clear();
            });
            const pt = this.mouse_coordinates(evt);
            this.transport.position = pt[0];
            this.transport.draw_cursor();
            if (this.transport.playing) {
                this.play_current_spline();
            }
        });
        this.svg.addEventListener("dblclick", evt => {
            // TODO: How to prevent accidental text selection?
            //evt.stopPropagation()
            //evt.preventDefault();
            this.stop_spline_playback();
            this.insert_new_knot(evt);
        });

        // Initial data
        this.load_spline(ZERO_SPLINE);
        this.update_ui()
        const url = HTTP_HOST + "/api/motors";
        fetch_json(url).then(motorInfos => {
            this.motorSelector.populate(motorInfos);
        });
    }

    /**
     * C1 continuity activated?
     */
    get c1() {
        return !is_checked(this.c1Btn);
    }

    /**
     * Populate toolbar with buttons and motor selection. Wire up event listeners.
     */
    setup_toolbar_elements() {
        // Editing history buttons
        this.undoBtn = this.add_button("undo", "Undo last action");
        this.undoBtn.addEventListener("click", evt => {
            this.history.undo();
            this.stop_spline_playback();
            this.draw_current_spline();
        });
        this.redoBtn = this.add_button("redo", "Redo last action")
        this.redoBtn.addEventListener("click", evt => {
            this.history.redo();
            this.stop_spline_playback();
            this.draw_current_spline();
        });

        this.add_space_to_toolbar();

        // C1 line continuity toggle button
        this.c1Btn = this.add_button("timeline", "Break continous knot transitions");
        this.c1Btn.addEventListener("click", evt => {
            toggle_button(this.c1Btn);
        });

        this.add_space_to_toolbar();

        // Zoom buttons
        this.add_button("zoom_in", "Zoom In").addEventListener("click", evt => {
            zoom_bbox_in_place(this.viewport, ZOOM_FACTOR_PER_STEP);
            this.update_trafo();
            this.draw();
        });
        this.add_button("zoom_out", "Zoom Out").addEventListener("click", evt => {
            zoom_bbox_in_place(this.viewport, 1 / ZOOM_FACTOR_PER_STEP);
            this.update_trafo();
            this.draw();
        });
        this.add_button("zoom_out_map", "Reset zoom").addEventListener("click", evt => {
            this.viewport = this.dataBbox.copy();
            this.update_trafo();
            this.draw();
        });

        this.add_space_to_toolbar();

        // Motor selection
        const select = this.add_select();
        select.addEventListener("change", evt => {
            this.stop_all_spline_playbacks();
        });
        this.motorSelector = new MotorSelector(select);

        this.add_space_to_toolbar();

        // Transport buttons
        this.playPauseBtn = this.add_button("play_arrow", "Play / pause motion playback");
        this.stopBtn = this.add_button("stop", "Stop spline playback").addEventListener("click", async evt => {
            this.stop_spline_playback();
            this.transport.stop();
        });
        this.loopBtn = this.add_button("loop", "Loop spline motion");
        this.loopBtn.addEventListener("click", evt => {
            this.transport.toggle_looping();
        });
        this.playPauseBtn.addEventListener("click", async evt => {
            if (this.transport.playing) {
                this.stop_spline_playback();
            } else {
                this.play_current_spline();
            }
        });
    }

    /**
     * Trigger viewport resize and redraw.
     */
    resize() {
        super.resize();
        this.draw();
    }

    /**
     * Draw spline editor stuff.
     */
    draw() {
        this.drawer.draw();
        this.backgroundDrawer.draw()
        this.transport.draw_cursor();
    }

    /**
     * Setup drag event handlers for moving horizontally and zooming vertically.
     */
    setup_svg_drag_navigation() {
        let start = null;
        let orig = null;
        let mid = 0;

        make_draggable(
            this.svg,
            evt => {
                start = [evt.clientX, evt.clientY];
                orig = this.viewport.copy();
                const pt = this.mouse_coordinates(evt);
                const alpha = clip((pt[0] - orig.left) / orig.width, 0, 1);
                mid = orig.left + alpha * orig.width;
            },
            evt => {
                // Affine image transformation with `mid` as "focal point"
                const end = [evt.clientX, evt.clientY];
                const delta = subtract_arrays(end, start);
                const shift = -delta[0] / this.width * orig.width;
                const factor = Math.exp(-0.01 * delta[1]);
                this.viewport.left = factor * (orig.left - mid + shift) + mid;
                this.viewport.right = factor * (orig.right - mid + shift) + mid;
                this.update_trafo();
                this.draw();
            },
            evt => {
                start = null;
                orig = null;
                mid = 0;
            },
        );
    }

    /**
     * Update UI elements. Mostly buttons at this time. Disabled state of undo
     * / redo buttons according to history.
     */
    update_ui() {
        this.undoBtn.disabled = !this.history.undoable;
        this.redoBtn.disabled = !this.history.redoable;
        if (this.transport.playing) {
            this.playPauseBtn.innerHTML = "pause";
        } else {
            this.playPauseBtn.innerHTML = "play_arrow";
        }

        if (this.transport.looping) {
            switch_button_on(this.loopBtn);
        } else {
            switch_button_off(this.loopBtn);
        }
    }

    /**
     * Load spline into spline editor.
     * Recalculate bounding box
     */
    load_spline(spline) {
        this.history.clear();
        this.history.capture(spline);
        const bbox = spline.bbox();
        bbox.expand_by_bbox(DEFAULT_DATA_BBOX);
        this.dataBbox = bbox;
        this.viewport = this.dataBbox.copy();
        this.update_trafo();
        this.draw_current_spline();
    }

    /**
     * Set current spline duration.
     *
     * @param {Number} duration Spline duration in seconds.
     */
    set_duration(duration) {
        this.transport.duration = duration;
        this.line.maxlen = .8 * duration / INTERVAL;
    }

    /**
     * Draw current version of spline from history.
     */
    draw_current_spline() {
        this.drawer.clear();
        const current = this.history.retrieve();
        const duration = current.end;
        this.set_duration(duration);
        this.drawer.draw_spline(current);
        this.update_ui();
    }

    /**
     * Notify spline editor that the spline working copy is going to change.
     */
    spline_changing() {
        this.stop_spline_playback();
    }

    /**
     * Notify spline editor that with the new current state of the spline.
     */
    spline_changed(workingCopy) {
        this.history.capture(workingCopy);
        this.draw_current_spline();
    }

    /**
     * Play current spline on Being. Start transport cursor.
     */
    async play_current_spline() {
        const url = this.motorSelector.selected_motor_url() + "/play";
        const spline = this.history.retrieve();
        const res = await fetch_json(url, "POST", {
            spline: spline.to_dict(),
            loop: this.transport.looping,
            offset: this.transport.position,
        });
        this.transport.startTime = res["startTime"] + INTERVAL;
        this.transport.play();
    }

    /**
     * Stop spline playback on Being for currently selected motor.
     */
    async stop_spline_playback() {
        const url = this.motorSelector.selected_motor_url() + "/stop";
        await fetch(url, { method: "POST" });
        this.transport.pause();
    }

    /**
     * Stop spline playback on Being for all known motors.
     */
    async stop_all_spline_playbacks() {
        this.transport.pause();
        const stopTasks = this.motorSelector.motorInfos.map(info => {
            const url = this.motorSelector.motor_url(info.id) + "/stop";
            return fetch(url, {method: "POST"});
        });
        await Promise.all(stopTasks);
    }

    /**
     * Insert new knot into current spline.
     */
    insert_new_knot(evt) {
        if (this.history.length === 0) {
            return;
        }

        const pos = this.mouse_coordinates(evt);
        const currentSpline = this.history.retrieve();
        const newSpline = currentSpline.copy();
        newSpline.insert_knot(pos);

        // TODO: Do some coefficients cleanup. Wrap around and maybe take the
        // direction of the previous knots as the new default coefficients...
        this.spline_changed(newSpline);
    }

    /**
     * Process new data message from backend.
     */
    new_data(msg) {
        // Clear of old data points in live plot
        if (!this.transport.playing) {
            this.line.data.popleft();
            return;
        }

        const t = this.transport.move(msg.timestamp);
        const actualValue = msg.values[this.motorSelector.actualValueIndex];
        this.line.append_data([t, actualValue]);
    }
}

customElements.define("being-editor", Editor);