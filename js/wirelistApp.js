// Part of the APK.audio project — http://APK.audio — made by Anthony Kuzub
// MIT Licence. Free, for everyone, for ever. Full text in LICENSE at the root.
/* wirelistApp.js — the Wirelist editor. The block goes in and out over
   cad.like.audio/host@1 (window.APKSoftapp.connectHost, vendor/apk-softapp/);
   the schedule is APKTable 'wirelist-runs' (vendor/apk-table/); "Discovered"
   lists what the bus knows (APKSoftapp.discoveredPanel, kinds in config/discovery.json)
   and starts a run at any of them. Open takes a wirelist .json or an IFC model (.ifc), and
   Open Bench reads the bench's model (GET /api/bim/bench.ifc): the runs are then a query over
   its IfcRelConnectsPorts (js/wirelistIfc.js, the contracts STEP codec in js/ifc/step.mjs). Save,
   standalone, writes the block AND its .ifc twin (js/wirelistToIfc.js) through APKSoftapp.saveModel;
   in the CAD, Save & Return hands the block back as before. */

import { WirelistModel, WIRELIST_BLOCK_TYPE, WIRELIST_COLUMNS, FT_TO_M } from './wirelistModel.js';
import { wirelistFromIfc, schemaOf } from './wirelistIfc.js';
import { wirelistToIfc } from './wirelistToIfc.js';

export const BENCH_IFC_URL = '/api/bim/bench.ifc';

export class WirelistApp {
  constructor() {
    this.model = new WirelistModel();
    const S = window.APKSoftapp;
    S.inheritTheme();

    this.initElements();
    this.makeTable();
    this.host = S.connectHost({
      editor: 'Wirelist Editor',
      blockType: WIRELIST_BLOCK_TYPE,
      onLoad: (block, meta) => this.handleBlockLoaded(block, meta),
      onRequest: () => this.model.toBlock(),
    });
    // the Discovered panel is the shared client's (ROAD-3502); start() draws it once, on first show
    this.discovered = {
      start: () => (this.discoveredRun ||= window.APKSoftapp?.discoveredPanel(document.getElementById('discovered-table'), {
        id: 'wirelist-discovered',
        status: document.getElementById('discovered-status'),
        configUrl: new URL('../config/discovery.json', import.meta.url),
        pickLabel: 'Run from here',
        onPick: (thing) => { this.model.addFromThing(thing); this.changed(); },
      })),
    };
    S.describe({
      name: 'Wirelist Editor',
      does: 'Keeps the facility cable schedule: every run with its type, length, both ends, signal, colour and install status, with the total length and count.',
      inputs: [
        { name: 'Wirelist block', from: 'the CAD drawing when opened from the CAD', kind: 'cad' },
        { name: 'Block file', from: 'a .json file picked with Open (a wirelist block, or a bare list of runs)', kind: 'file' },
        { name: 'IFC model', from: 'an .ifc picked with Open: every IfcRelConnectsPorts becomes a run (cable tag, both ends with connector, system)', kind: 'file' },
        { name: 'Bench model', from: 'GET ' + BENCH_IFC_URL + ' (DATABASE.server.BIM) with Open Bench', kind: 'http' },
        { name: 'On the network', from: 'what the bus has discovered; which kinds show is config/discovery.json', kind: 'bus' },
      ],
      outputs: [
        { name: 'Wirelist block', to: 'the CAD drawing on Save & Return; standalone, wirelist.json beside its twin', kind: 'file' },
        { name: 'IFC twin', to: 'wirelist.ifc (IFC4X3_ADD2) with the .json when standalone: each run an IfcCableSegment with two end ports, joined by IfcRelConnectsPorts', kind: 'file' },
        { name: 'Wirelist CSV', to: 'facility_wirelist.csv download (Export CSV): every column, with both connectors and the system', kind: 'file' },
      ],
      controls: [
        { name: 'Open / Open Bench', how: 'Open a .json or .ifc; Open Bench reads the bench model from the BIM server' },
        { name: 'Add cable run', how: '+ Add Cable Run, then edit its cells; or Run from here on a Discovered row' },
        { name: 'Edit / delete a run', how: 'Edit the cell or delete the row in the table' },
        { name: 'Search', how: 'Type in the search box to filter runs' },
        { name: 'Discovered', how: 'Top-bar button: show what is on the network' },
        { name: 'Export CSV / Save & Return / Close', how: 'Buttons above the table and in the top bar' },
      ],
      problems: ['file_unreadable', 'bad_json', 'bad_input', 'bus_missing', 'http_not_found', 'save_failed'],
    });
    this.attachEvents();
    this.render();
  }

  initElements() {
    this.btnOpen = document.getElementById('btn-open');
    this.btnOpenBench = document.getElementById('btn-open-bench');
    this.btnSave = document.getElementById('btn-save');
    this.btnClose = document.getElementById('btn-close');
    this.btnSyncDiscovered = document.getElementById('btn-sync-discovered');
    this.discoveredPanelEl = document.getElementById('discovered-panel');
    this.totalCableEl = document.getElementById('total-length');
    this.totalCountEl = document.getElementById('total-count');
    this.btnAddWire = document.getElementById('btn-add-wire');
    this.btnExportCsv = document.getElementById('btn-export');
    this.searchInput = document.getElementById('search-input');
  }

  makeTable() {
    this.table = window.APKTable.create(document.getElementById('wire-table'), {
      id: 'wirelist-runs',
      toolbar: false,
      columns: WIRELIST_COLUMNS,
      rows: this.model.wires,
      onEdit: (i, key, value) => {   // the cell already shows it; only the totals move
        this.model.updateWire(i, key, value);
        this.renderMetrics();
        this.host.changed(this.model.toBlock());
      },
      onDelete: (i) => { this.model.removeWire(i); this.changed(); },
      empty: 'No cable runs yet.',
    });
  }

  attachEvents() {
    this.btnOpen?.addEventListener('click', () => this.promptOpen());
    this.btnOpenBench?.addEventListener('click', () => this.openBench());
    this.btnSave?.addEventListener('click', () => this.saveBlock());
    this.btnClose?.addEventListener('click', () => this.host.close());
    this.btnSyncDiscovered?.addEventListener('click', () => {
      if (this.discoveredPanelEl) this.discoveredPanelEl.hidden = !this.discoveredPanelEl.hidden;
      this.discovered.start();
    });
    this.searchInput?.addEventListener('input', () => this.table.filter(this.searchInput.value));
    this.btnAddWire?.addEventListener('click', () => {
      this.model.addWire({ type: 'Cat6A STP', lenFt: 50, from: 'CORE-SW01', to: 'DEVICE-NEW', signal: 'Network', color: 'Blue' });
      this.changed();
    });
    this.btnExportCsv?.addEventListener('click', () => this.table.exportCsv('facility_wirelist.csv'));
  }

  changed() {
    this.render();
    this.host.changed(this.model.toBlock());
  }

  handleBlockLoaded(block, meta = {}) {
    if (!this.model.fromBlock(block)) {
      window.APKSoftapp.showProblem('bad_input', {
        subject: meta.title || meta.blockName || 'Wirelist block',
        detail: 'This is not a wirelist: it has no "wires" list.',
        fix: ['Open a .json saved by this editor (a block with "wires", or a bare list of runs), or start one with + Add Cable Run.'],
      });
      return false;
    }
    const tag = document.getElementById('block-tag');
    if (tag && (meta.title || meta.blockName)) tag.textContent = meta.title || meta.blockName;
    this.render();
    return true;
  }

  /** In the CAD: the block back to the drawing. Standalone: the block and its .ifc twin, both or neither. */
  async saveBlock() {
    const block = this.model.toBlock();
    const meta = { title: `Wirelist (${block.totalCables} Runs · ${block.totalLengthFt} ft)`, filename: 'wirelist' };
    const S = window.APKSoftapp;
    if (this.host.embedded || typeof S.saveModel !== 'function') return this.host.save(block, meta);
    const r = await S.saveModel(block, { name: meta.filename, toIfc: (b) => wirelistToIfc(b, { name: meta.filename }) });
    if (!r.ok && !r.cancelled) S.showProblem(r.problem || 'save_failed', { onRetry: () => this.saveBlock() });
    return r.ok ? r.via : '';
  }

  render() {
    this.renderMetrics();
    this.table.setRows(this.model.wires);
  }

  renderMetrics() {
    const totalFt = this.model.getTotalLength();
    this.totalCableEl.textContent = `Total Length: ${totalFt.toLocaleString()} ft (${Math.round(totalFt * FT_TO_M)} m)`;
    this.totalCountEl.textContent = `${this.model.wires.length} Cable Runs`;
  }

  /** Runs from an IFC model's IfcRelConnectsPorts; false (and a problem card) when it is not one. */
  loadIfc(text, name) {
    let rows;
    let schema = '';
    try {
      rows = wirelistFromIfc(text);
      schema = schemaOf(text) || '';
    } catch (err) {
      window.APKSoftapp.showProblem('bad_input', { subject: name, detail: err.message, fix: ['Open an .ifc written by an IFC tool (ISO 10303-21), or the bench model with Open Bench.'] });
      return false;
    }
    if (!this.handleBlockLoaded({ wires: rows }, { title: `${name} · ${schema} · ${rows.length} runs` })) return false;
    this.host.changed(this.model.toBlock());
    return true;
  }

  /** The bench as DATABASE.server.BIM keeps it (bench.ifc, its stored twin of bench.json). */
  async openBench() {
    const S = window.APKSoftapp;
    if (S.openModel) {
      const r = await S.openModel({ url: BENCH_IFC_URL });
      if (!r.ok) { if (!r.cancelled) S.showProblem(r.problem, { onRetry: () => this.openBench() }); return false; }
      return this.loadIfc(r.text, 'bench.ifc');
    }
    try {
      const res = await fetch(BENCH_IFC_URL, { headers: { Accept: 'model/step' } });
      if (!res.ok) throw Object.assign(new Error(`HTTP ${res.status} for ${BENCH_IFC_URL}`), { status: res.status });
      return this.loadIfc(await res.text(), 'bench.ifc');
    } catch (err) {
      S.showProblem(err.status === 404 ? 'http_not_found' : 'file_unreadable', { subject: BENCH_IFC_URL, detail: err.message, onRetry: () => this.openBench() });
      return false;
    }
  }

  /** Open a wirelist .json or an IFC model (.ifc; an ISO 10303-21 header decides for any other name). */
  async promptOpen() {
    const S = window.APKSoftapp;
    if (S.openModel) {   // the shared Open Model (apk-softapp.js) once vendor/apk-softapp carries it
      const r = await S.openModel({});
      if (!r.ok) { if (!r.cancelled) S.showProblem(r.problem, { onRetry: () => this.promptOpen() }); return; }
      if (r.kind === 'ifc') this.loadIfc(r.text, r.name);
      else if (this.handleBlockLoaded(r.model, { title: r.name })) this.host.changed(this.model.toBlock());
      return;
    }
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json,.ifc,application/json,model/step';
    input.onchange = (e) => {
      const file = e.target.files[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = (re) => {
        const text = String(re.target.result);
        if (/\.ifc$/i.test(file.name) || /^\s*ISO-10303-21\s*;/.test(text)) { this.loadIfc(text, file.name); return; }
        let block;
        try {
          block = JSON.parse(text);
        } catch (err) {
          S.showProblem('bad_json', { subject: file.name, detail: err.message, onRetry: () => this.promptOpen() });
          return;
        }
        if (this.handleBlockLoaded(block, { title: file.name })) this.host.changed(this.model.toBlock());
      };
      reader.onerror = () => S.showProblem('file_unreadable', { subject: file.name, detail: reader.error && reader.error.message, onRetry: () => this.promptOpen() });
      reader.readAsText(file);
    };
    input.click();
  }
}

if (typeof window !== 'undefined') {
  window.addEventListener('DOMContentLoaded', () => {
    window.wirelistApp = new WirelistApp();
  });
}
