"use strict";
import { remove_all_children, is_valid_filename } from "/static/js/utils.js";
import { BPoly } from "/static/js/spline.js";
import { Api } from "/static/js/api.js";
import { create_button } from "/static/js/widget.js";


export class SplineList {
    constructor(editor) {
        this.editor = editor;
        this.splines = [];
        this.visibles = new Set();
        this.selected = null;
        this.api = new Api();

        this.init_elements();
    }

    /**
     * Load splines from back end and display in spline list.
     */
    async reload_spline_list() {
        const res = await this.api.fetch_splines();
        res.forEach(spline => {
            spline.content = BPoly.from_object(spline.content);
        });
        this.populate(res);
        this.editor.resize();
    }

    /**
     * Build node and attach to parent (editor)
     */
    init_elements() {
        const container = this.editor.motionListDiv;

        this.splineListDiv = document.createElement("div");
        //this.splineListDiv.style.borderBottom = "2px solid black";
        this.splineListDiv.style.paddingBottom = "5px";
        container.appendChild(this.splineListDiv);
        container.appendChild(document.createElement("hr"));

        const newBtnContainer = document.createElement("div");
        newBtnContainer.id = "spline-list-toolbar";
        container.appendChild(newBtnContainer);
        newBtnContainer.style.display = "flex";
        newBtnContainer.style.justifyContent = "center";

        const addSplineButton = create_button("add_box", "Create new spline");
        newBtnContainer.appendChild(addSplineButton);
        addSplineButton.addEventListener("click", async () => {
            this.editor.create_new_spline();
            this.reload_spline_list();
        });

        const delSplineButton = create_button("delete", "Delete selected motion");
        newBtnContainer.appendChild(delSplineButton);
        delSplineButton.addEventListener("click", () => {
            if (confirm("Delete motion " + this.selected + " permanently ?")) {
                this.api.delete_spline(this.selected).then(resp => {
                    if (resp.ok) {
                        this.visibles.delete(this.selected);
                        this.selected = null;
                        this.reload_spline_list();
                    }
                });
            }
        });

        const duplSplineButton = create_button("file_copy", "Duplicate motion file");
        newBtnContainer.appendChild(duplSplineButton);
        duplSplineButton.addEventListener("click", () => {
            this.api.duplicate_spline(this.selected).then(() => {
                this.reload_spline_list();
            });
        });
    }

    update_spline_list() {
        remove_all_children(this.splineListDiv);

        this.splines.forEach(spline => {
            const entry = document.createElement("div");
            entry.classList.add("spline-list-entry");
            entry.classList.add("noselect");
            entry.id = spline.filename;
            entry.addEventListener("click", evt => {
                if (this.editor.history.savable && !confirm("Discard unsaved edits?")) {
                    return;
                }

                if (evt.currentTarget.id !== this.selected) {
                    if (!this.preSelectVisibility) {
                        this.visibles.delete(this.selected);
                    }

                    this.selected = evt.currentTarget.id;
                    this.preSelectVisibility = this.visibles.has(this.selected);
                    // this.visibles.add(evt.currentTarget.id);
                    this.update_spline_list_selection();
                    this.draw_selected_spline();
                    const selectedSpline = this.splines.filter(sp => sp.filename === this.selected)[0];
                    this.editor.load_spline(selectedSpline.content);
                    this.draw_background_splines();
                }
            });

            const checkbox = document.createElement("span");
            checkbox.classList.add("spline-checkbox");
            checkbox.classList.add("material-icons");
            checkbox.classList.add("mdc-icon-button");
            checkbox.innerHTML = "";
            checkbox.value = spline.filename;
            checkbox.title = "Show in Graph";
            checkbox.addEventListener("click", evt => {
                evt.stopPropagation();
                const filename = evt.target.parentNode.id;
                if (this.selected === filename) {
                    this.preSelectVisibility = true;
                }

                if (this.visibles.has(filename)) {
                    this.visibles.delete(filename);
                } else {
                    this.visibles.add(filename);
                }

                this.update_spline_list_selection();
                this.draw_background_splines();
            }, true);
            checkbox.addEventListener("mouseover", evt => {
                evt.stopPropagation();
                evt.currentTarget.innerHTML = "visibility";
            });
            checkbox.addEventListener("mouseout", evt => {
                const filename = evt.target.parentNode.id;
                if (!this.visibles.has(filename)) {
                    evt.currentTarget.innerHTML = "";
                }
            });

            const text = document.createElement("span");
            text.innerHTML = spline.filename;
            text.contentEditable = "false";  // "false" prevents text syntax highlighting
            text.title = "Double click to edit";
            text.setAttribute("required", "");
            text.classList.add("truncate");
            entry.append(checkbox, text);
            text.addEventListener("blur", evt => {
                let current_elem = evt.currentTarget;
                evt.currentTarget.contentEditable = "false";
                if (this.origFilename !== evt.currentTarget.innerHTML) {
                    const newFilename = evt.currentTarget.innerHTML;
                    if (newFilename.length <= 0 ||
                        newFilename === "<br>" ||
                        newFilename === "<p>" ||
                        newFilename === "<div>" ||
                        !is_valid_filename(newFilename)) {
                        evt.currentTarget.innerHTML = this.origFilename;
                    } else {
                        this.api.rename_spline(this.origFilename, newFilename).then(() => {
                            // local update
                            // We dont want to reload from the server because we want to keep the 
                            // evenetually modified spline and history when renaming
                            let spl = this.splines.filter(sp => sp.filename === this.origFilename)[0];
                            spl.filename = newFilename;

                            if (this.selected === this.origFilename) {
                                this.selected = newFilename;
                            }

                            if (this.visibles.has(this.origFilename)) {
                                this.visibles.delete(this.origFilename);
                                this.visibles.add(newFilename);
                            }

                            const filename_div = this.editor.shadowRoot.getElementById(this.origFilename);
                            filename_div.id = newFilename;
                            console.log("renamed!!");
                        }).catch(() => {
                            // same filename exists
                            current_elem.innerHTML = this.origFilename;
                        });
                    }
                }

                evt.currentTarget.classList.remove("nonvalid");
            });
            text.addEventListener("keyup", evt => {
                if (!is_valid_filename(evt.currentTarget.innerHTML)) {
                    evt.currentTarget.classList.add("nonvalid");
                } else {
                    evt.currentTarget.classList.remove("nonvalid");
                }
                // Keyup eventListener needed to capture meta keys
                if (evt.key === "Escape") {
                    evt.currentTarget.innerHTML = this.origFilename;
                    evt.currentTarget.blur();  // saving file handled by "blur" eventListener
                }
            });
            text.addEventListener("dblclick", evt => {
                if (!evt.currentTarget.isContentEditable) {
                    evt.currentTarget.contentEditable = "true";
                    evt.currentTarget.focus();
                    this.origFilename = evt.currentTarget.innerHTML;
                }
            });
            text.addEventListener("keypress", evt => {
                // Keypress eventListener (compared to keyup) fires before contenteditable adds <br>
                if (evt.key === "Enter") {
                    evt.currentTarget.blur();  // saving file handled by "blur" eventListener
                }
            });
            this.splineListDiv.append(entry);
        });
        this.update_spline_list_selection();
        this.draw_background_splines();
    }

    draw_background_splines() {
        this.editor.backgroundDrawer.clear();

        let background_splines = this.splines.filter(sp => {
            return (this.visibles.has(sp.filename) && sp.filename !== this.selected);
        });

        for (let index in background_splines) {
            const spline_to_draw = background_splines[index].content;
            this.editor.backgroundDrawer.draw_spline(spline_to_draw, false);
        }

        this.editor.backgroundDrawer.draw();
    }

    update_spline_list_selection() {
        const entries = this.editor.shadowRoot.querySelectorAll(".spline-list-entry");
        entries.forEach(entry => {
            entry.removeAttribute("checked");
            entry.querySelector(".spline-checkbox").innerHTML = "";
        });

        // Preselection 
        if (this.selected == null) {
            const latest = this.splines.length - 1;
            if (latest >= 0) {
                const spline_fd = this.splines[latest].filename;
                this.selected = spline_fd;
                this.preSelectVisibility = false;
            }
            this.draw_selected_spline();
        }

        if (this.selected !== null) {
            this.editor.shadowRoot.getElementById(this.selected).setAttribute("checked", "");
            this.visibles.forEach(filename => {
                const parent = this.editor.shadowRoot.getElementById(filename);
                const checkbox = parent.querySelector(".spline-checkbox");
                checkbox.innerHTML = "visibility";
            });
        }
    }

    /**
     * Draw the currently selected spline in editor panel (if any).
     */
    draw_selected_spline() {
        for (const sp of this.splines) {
            if (sp.filename === this.selected) {
                this.editor.load_spline(sp.content);
                break;
            }
        }
    }

    /**
     * Populate spline list with splines.
     *
     * @param {Array} splines Array of spline like objects (filename and content).
     */
    populate(splines) {
        this.splines = splines;
        this.update_spline_list();
    }
}
