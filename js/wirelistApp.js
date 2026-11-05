// Part of the APK.audio project — http://APK.audio — made by Anthony Kuzub
// MIT Licence. Free, for everyone, for ever. Full text in LICENSE at the root.
/* wirelistApp.js — the Wirelist editor. The block goes in and out over
   cad.like.audio/host@1 (window.APKSoftapp.connectHost, vendor/apk-softapp/);
   the schedule is APKTable 'wirelist-runs' (vendor/apk-table/); "Discovered"
   lists what the bus knows (js/discoveredPanel.js, kinds in config/discovery.json)
   and starts a run at any of them. */

import { WirelistModel, WIRELIST_BLOCK_TYPE, WIRE_STATUSES, FT_TO_M } from './wirelistModel.js';
import { DiscoveredPanel } from './discoveredPanel.js';

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
    this.discovered = new DiscoveredPanel({
      tableId: 'wirelist-discovered',
      tableHost: document.getElementById('discovered-table'),
      statusEl: document.getElementById('discovered-status'),
      configUrl: new URL('../config/discovery.json', import.meta.url),
      pickLabel: 'Run from here',
      onPick: (thing) => { this.model.addFromThing(thing); this.changed(); },
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
    if (!this.model.fromBlock(block)) return;
    const tag = document.getElementById('block-tag');
    if (tag && (meta.title || meta.blockName)) tag.textContent = meta.title || meta.blockName;
    this.render();
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
      const reader = new FileReader();
      reader.onload = (re) => {
        try {
          this.handleBlockLoaded(JSON.parse(re.target.result), { title: file.name });
          this.host.changed(this.model.toBlock());
        } catch (err) {
          alert('Invalid JSON wirelist block');
        }
      };
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
