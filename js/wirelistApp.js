// Part of the APK.audio project — http://APK.audio — made by Anthony Kuzub
// MIT Licence. Free, for everyone, for ever. Full text in LICENSE at the root.

import { BlockBridge } from './blockBridge.js';
import { WirelistModel } from './wirelistModel.js';

export class WirelistApp {
  constructor() {
    this.model = new WirelistModel();

    this.bridge = new BlockBridge({
      name: 'Wirelist Editor',
      type: 'wirelist',
      onBlockLoaded: (block, meta) => this.handleBlockLoaded(block, meta),
      onBlockChanged: () => {},
    });

    this.initElements();
    this.attachEvents();
    this.loadInitialData();
  }

  initElements() {
    this.btnOpen = document.getElementById('btn-open');
    this.btnSave = document.getElementById('btn-save');
    this.btnClose = document.getElementById('btn-close');
    this.btnSyncDiscovered = document.getElementById('btn-sync-discovered');

    this.tableBody = document.getElementById('wire-table-body');
    this.totalCableEl = document.getElementById('total-length');
    this.totalCountEl = document.getElementById('total-count');

    this.btnAddWire = document.getElementById('btn-add-wire');
    this.btnExportCsv = document.getElementById('btn-export');
    this.searchInput = document.getElementById('search-input');
  }

  attachEvents() {
    this.btnOpen?.addEventListener('click', () => this.promptOpen());
    this.btnSave?.addEventListener('click', () => this.saveBlock());
    this.btnClose?.addEventListener('click', () => this.bridge.close());
    this.btnSyncDiscovered?.addEventListener('click', () => this.loadFromDiscoveredProject());

    this.searchInput?.addEventListener('input', () => this.renderTable());

    this.btnAddWire?.addEventListener('click', () => {
      const nextNum = (this.model.wires.length + 1).toString().padStart(3, '0');
      this.model.wires.push({
        id: `W-${nextNum}`,
        type: 'Cat6A STP',
        lenFt: 50,
        from: 'CORE-SW01',
        to: 'DEVICE-NEW',
        status: 'Unpulled',
        signal: 'Network',
        color: 'Blue',
      });
      this.render();
      this.bridge.notifyChanged();
    });

    this.btnExportCsv?.addEventListener('click', () => {
      const headers = ['WireNumber', 'Type', 'LengthFt', 'Origin', 'Destination', 'Signal', 'Color', 'Status'];
      const rows = this.model.wires.map(w =>
        `"${w.id}","${w.type}",${w.lenFt},"${w.from}","${w.to}","${w.signal}","${w.color}","${w.status}"`
      );
      const csv = [headers.join(','), ...rows].join('\n');
      const blob = new Blob([csv], { type: 'text/csv' });
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = `facility_wirelist_${Date.now()}.csv`;
      a.click();
    });
  }

  loadInitialData() {
    this.loadFromDiscoveredProject().catch(() => {
      this.render();
    });
  }

  async loadFromDiscoveredProject() {
    try {
      const data = await this.bridge.fetchDiscoveredProject();
      if (data && (data.cables || data.wires || data.runs || data.connections)) {
        const raw = data.cables || data.wires || data.runs || data.connections;
        if (Array.isArray(raw) && raw.length > 0) {
          this.model.wires = raw.map((w, i) => ({
            id: w.wireNumber || w.id || `W-${(i + 1).toString().padStart(3, '0')}`,
            type: w.wireType || w.type || 'Cat6A STP',
            lenFt: w.lenFt || w.length || 50,
            from: w.source || w.from || 'Origin',
            to: w.destination || w.to || 'Destination',
            status: w.status || 'Verified',
            signal: w.signal || 'Network',
            color: w.color || 'Blue',
          }));
          this.render();
          return;
        }
      }
    } catch (_) {}
    this.render();
  }

  handleBlockLoaded(block, meta = {}) {
    if (!block) return;
    if (Array.isArray(block.wires)) {
      this.model.wires = block.wires;
    } else if (Array.isArray(block)) {
      this.model.wires = block;
    }
    this.render();
  }

  saveBlock() {
    const block = {
      type: 'wirelist',
      wires: this.model.wires,
      totalLengthFt: this.model.getTotalLength(),
      totalCables: this.model.wires.length,
      timestamp: new Date().toISOString(),
    };
    this.bridge.saveBlock(block, {
      title: `Wirelist (${this.model.wires.length} Runs · ${block.totalLengthFt} ft)`,
      filename: `wirelist_${Date.now()}`,
    });
  }

  render() {
    this.renderMetrics();
    this.renderTable();
  }

  renderMetrics() {
    const totalFt = this.model.getTotalLength();
    this.totalCableEl.textContent = `Total Length: ${totalFt.toLocaleString()} ft (${Math.round(totalFt * 0.3048)} m)`;
    this.totalCountEl.textContent = `${this.model.wires.length} Cable Runs`;
  }

  renderTable() {
    this.tableBody.innerHTML = '';
    const q = (this.searchInput?.value || '').toLowerCase();

    this.model.wires
      .filter(w => !q || w.id.toLowerCase().includes(q) || w.from.toLowerCase().includes(q) || w.to.toLowerCase().includes(q) || w.type.toLowerCase().includes(q))
      .forEach((w) => {
        const globalIdx = this.model.wires.indexOf(w);
        const tr = document.createElement('tr');
        tr.innerHTML = `
          <td><input type="text" class="cell-input" data-idx="${globalIdx}" data-field="id" value="${w.id}"></td>
          <td><input type="text" class="cell-input" data-idx="${globalIdx}" data-field="type" value="${w.type}"></td>
          <td style="width:70px;"><input type="number" class="cell-input text-center" data-idx="${globalIdx}" data-field="lenFt" value="${w.lenFt}"></td>
          <td><input type="text" class="cell-input" data-idx="${globalIdx}" data-field="from" value="${w.from}"></td>
          <td><input type="text" class="cell-input" data-idx="${globalIdx}" data-field="to" value="${w.to}"></td>
          <td><input type="text" class="cell-input" data-idx="${globalIdx}" data-field="signal" value="${w.signal || ''}"></td>
          <td style="width:75px;"><input type="text" class="cell-input" data-idx="${globalIdx}" data-field="color" value="${w.color || ''}"></td>
          <td style="width:110px;">
            <select class="cell-input" data-idx="${globalIdx}" data-field="status">
              <option value="Unpulled" ${w.status === 'Unpulled' ? 'selected' : ''}>Unpulled</option>
              <option value="Pulled" ${w.status === 'Pulled' ? 'selected' : ''}>Pulled</option>
              <option value="Terminated" ${w.status === 'Terminated' ? 'selected' : ''}>Terminated</option>
              <option value="Verified" ${w.status === 'Verified' ? 'selected' : ''}>Verified</option>
            </select>
          </td>
          <td class="col-actions">
            <button class="btn-icon btn-del-wire" data-idx="${globalIdx}" title="Delete Cable">🗑</button>
          </td>
        `;
        this.tableBody.appendChild(tr);
      });

    this.tableBody.querySelectorAll('.cell-input').forEach(input => {
      input.addEventListener('input', (e) => {
        const i = parseInt(e.target.dataset.idx, 10);
        const f = e.target.dataset.field;
        let val = e.target.value;
        if (f === 'lenFt') val = parseInt(val, 10) || 0;
        this.model.wires[i][f] = val;
        this.renderMetrics();
        this.bridge.notifyChanged();
      });
    });

    this.tableBody.querySelectorAll('.btn-del-wire').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const i = parseInt(e.target.dataset.idx, 10);
        this.model.wires.splice(i, 1);
        this.render();
        this.bridge.notifyChanged();
      });
    });
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
          const parsed = JSON.parse(re.target.result);
          this.handleBlockLoaded(parsed, { title: file.name });
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
