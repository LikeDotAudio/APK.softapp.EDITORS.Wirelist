// Part of the APK.audio project — http://APK.audio — made by Anthony Kuzub
// MIT Licence. Free, for everyone, for ever. Full text in LICENSE at the root.
/* wirelistApp.js — the Wirelist editor. The block goes in and out over
   cad.like.audio/host@1 (window.APKSoftapp.connectHost, vendor/apk-softapp/);
   the schedule is APKTable 'wirelist-runs' (vendor/apk-table/); "Discovered"
   lists what the bus knows (APKSoftapp.discoveredPanel, kinds in config/discovery.json)
   and starts a run at any of them. */

import { WirelistModel, WIRELIST_BLOCK_TYPE, WIRE_STATUSES, FT_TO_M } from './wirelistModel.js';

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
        { name: 'On the network', from: 'what the bus has discovered; which kinds show is config/discovery.json', kind: 'bus' },
      ],
      outputs: [
        { name: 'Wirelist block', to: 'the CAD drawing on Save & Return, or a .json download when standalone', kind: 'file' },
        { name: 'Wirelist CSV', to: 'facility_wirelist.csv download (Export CSV)', kind: 'file' },
      ],
      controls: [
        { name: 'Add cable run', how: '+ Add Cable Run, then edit its cells; or Run from here on a Discovered row' },
        { name: 'Edit / delete a run', how: 'Edit the cell or delete the row in the table' },
        { name: 'Search', how: 'Type in the search box to filter runs' },
        { name: 'Discovered', how: 'Top-bar button: show what is on the network' },
        { name: 'Export CSV / Save & Return / Close', how: 'Buttons above the table and in the top bar' },
      ],
      problems: ['file_unreadable', 'bad_json', 'bad_input', 'bus_missing'],
    });
    this.attachEvents();
    this.render();
  }

  initElements() {
    this.btnOpen = document.getElementById('btn-open');
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
      columns: [
        { key: 'id', label: 'Wire #', mono: true },
        { key: 'type', label: 'Cable Type / Model' },
        { key: 'lenFt', label: 'Len (ft)', type: 'number' },
        { key: 'from', label: 'Origin / Source' },
        { key: 'to', label: 'Destination' },
        { key: 'signal', label: 'Signal Type' },
        { key: 'color', label: 'Color' },
        { key: 'status', label: 'Status', type: 'select', options: WIRE_STATUSES },
      ],
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

  saveBlock() {
    const block = this.model.toBlock();
    this.host.save(block, {
      title: `Wirelist (${block.totalCables} Runs · ${block.totalLengthFt} ft)`,
      filename: 'wirelist',
    });
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

  promptOpen() {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json';
    input.onchange = (e) => {
      const file = e.target.files[0];
      if (!file) return;
      const S = window.APKSoftapp;
      const reader = new FileReader();
      reader.onload = (re) => {
        let block;
        try {
          block = JSON.parse(re.target.result);
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
