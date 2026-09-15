import React, { useState, useEffect } from 'react';
import { useApp } from './AppContext';
import { ProductionRecord, RejectionRecord, HourlyTemperature } from './types';
import { fetchProductionRecords, fetchHourlyTemperatures, fetchRejectionRecords, logAudit } from './dbService';
import * as XLSX from 'xlsx';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { Download, FileSpreadsheet, FileText, Printer, Filter, Calendar } from 'lucide-react';

export const ReportsExport: React.FC = () => {
  const { currentUser, gdcMachines, models, hourSlots } = useApp();

  const [startDate, setStartDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [endDate, setEndDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [shift, setShift] = useState<string>('ALL');
  const [furnace, setFurnace] = useState<string>('ALL');
  const [gdc, setGdc] = useState<string>('ALL');
  const [model, setModel] = useState<string>('ALL');

  const [records, setRecords] = useState<ProductionRecord[]>([]);
  const [temperatures, setTemperatures] = useState<HourlyTemperature[]>([]);
  const [rejections, setRejections] = useState<RejectionRecord[]>([]);
  const [loading, setLoading] = useState(false);

  const loadReportData = async () => {
    try {
      setLoading(true);
      const [prods, temps, rejs] = await Promise.all([
        fetchProductionRecords({
          startDate,
          endDate,
          shift,
          furnace,
          gdc,
          model
        }),
        fetchHourlyTemperatures(startDate, shift),
        fetchRejectionRecords(startDate, endDate)
      ]);
      setRecords(prods);
      setTemperatures(temps);
      setRejections(rejs);
    } catch (e) {
      console.error('Failed to load report data:', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadReportData();
  }, [startDate, endDate, shift, furnace, gdc, model]);

  // Export to Excel
  const handleExportExcel = async () => {
    const wb = XLSX.utils.book_new();

    // Sheet 1: Hourly Production Records
    const prodRows = records.map(r => ({
      'Date': r.date,
      'Shift': r.shift,
      'Supervisor': r.supervisor,
      'Hour Slot': `${r.hour_start} - ${r.hour_end}`,
      'Furnace': r.furnace,
      'GDC Machine': r.gdc_machine,
      'Model': r.model,
      'Planned Qty': r.planned_qty,
      'Actual Qty': r.actual_qty,
      'Achievement %': r.achievement_pct,
      'Breakdown (min)': r.breakdown_min,
      'Remarks': r.remarks
    }));
    const wsProd = XLSX.utils.json_to_sheet(prodRows);
    XLSX.utils.book_append_sheet(wb, wsProd, 'Hourly Production');

    // Sheet 2: Temperatures
    const tempRows = temperatures.map(t => ({
      'Date': t.date,
      'Shift': t.shift,
      'Hour Slot': t.hour_id,
      'Furnace 1 Temp (°C)': t.furnace_1_temperature,
      'Furnace 2 Temp (°C)': t.furnace_2_temperature,
      'Remarks': t.remarks || ''
    }));
    const wsTemp = XLSX.utils.json_to_sheet(tempRows);
    XLSX.utils.book_append_sheet(wb, wsTemp, 'Temperatures');

    // Sheet 3: Rejections
    const rejRows = rejections.map(rej => ({
      'Date': rej.date,
      'Shift': rej.shift,
      'Furnace': rej.furnace,
      'GDC Machine': rej.gdc_machine,
      'Model': rej.model,
      'Category': rej.rejection_category,
      'Side': rej.side,
      'Quantity': rej.quantity,
      'Remarks': rej.remarks || ''
    }));
    const wsRej = XLSX.utils.json_to_sheet(rejRows);
    XLSX.utils.book_append_sheet(wb, wsRej, 'Rejections');

    XLSX.writeFile(wb, `DSPL_Manufacturing_MIS_${startDate}_to_${endDate}.xlsx`);
    await logAudit(currentUser, 'EXPORT', 'reports', `excel_${startDate}_${endDate}`);
  };

  // Export to CSV
  const handleExportCSV = async () => {
    const prodRows = records.map(r => ({
      Date: r.date,
      Shift: r.shift,
      Supervisor: r.supervisor,
      Hour_Start: r.hour_start,
      Hour_End: r.hour_end,
      Furnace: r.furnace,
      GDC_Machine: r.gdc_machine,
      Model: r.model,
      Plan: r.planned_qty,
      Actual: r.actual_qty,
      Achievement_Pct: r.achievement_pct,
      Breakdown_Min: r.breakdown_min,
      Remarks: `"${(r.remarks || '').replace(/"/g, '""')}"`
    }));

    const ws = XLSX.utils.json_to_sheet(prodRows);
    const csv = XLSX.utils.sheet_to_csv(ws);
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.setAttribute('download', `DSPL_Hourly_Production_${startDate}_${endDate}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    await logAudit(currentUser, 'EXPORT', 'reports', `csv_${startDate}_${endDate}`);
  };

  // Export to PDF
  const handleExportPDF = async () => {
    const doc = new jsPDF();

    // Header Title
    doc.setFontSize(16);
    doc.text('DSPL 8-GDC HOURLY MANUFACTURING MIS REPORT', 14, 15);
    doc.setFontSize(9);
    doc.setTextColor(100);
    doc.text(`Generated on: ${new Date().toLocaleString()} | User: ${currentUser.name}`, 14, 21);
    doc.text(`Filter Range: ${startDate} to ${endDate} | Shift: ${shift} | Furnace: ${furnace}`, 14, 26);

    const tableData = records.map(r => [
      r.date,
      r.shift,
      `${r.hour_start}-${r.hour_end}`,
      r.gdc_machine,
      r.model,
      r.planned_qty,
      r.actual_qty,
      `${r.achievement_pct}%`,
      `${r.breakdown_min}m`,
      r.remarks || '-'
    ]);

    autoTable(doc, {
      startY: 32,
      head: [['Date', 'Shift', 'Time', 'GDC', 'Model', 'Plan', 'Actual', 'Ach %', 'B/D', 'Remarks']],
      body: tableData,
      theme: 'grid',
      headStyles: { fillColor: [30, 41, 59], fontSize: 8 },
      bodyStyles: { fontSize: 7 },
      columnStyles: {
        5: { halign: 'right' },
        6: { halign: 'right' },
        7: { halign: 'right' },
        8: { halign: 'right' }
      }
    });

    doc.save(`DSPL_MIS_Report_${startDate}_${endDate}.pdf`);
    await logAudit(currentUser, 'EXPORT', 'reports', `pdf_${startDate}_${endDate}`);
  };

  return (
    <div id="reports-export-container" className="space-y-6">
      {/* Banner */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-indigo-50 text-indigo-700 border border-indigo-200">
              Reporting & Audit Export
            </span>
            <span className="text-xs text-slate-500">Official Factory Dispatch & Documentation</span>
          </div>
          <h1 className="text-lg font-bold text-slate-900 mt-1">Manufacturing MIS Report Generator</h1>
        </div>

        <div className="flex items-center gap-2">
          <button
            id="export-excel-btn"
            type="button"
            onClick={handleExportExcel}
            className="inline-flex items-center gap-2 px-3.5 py-2 bg-emerald-600 text-white rounded-lg text-xs font-bold hover:bg-emerald-700 shadow-sm transition-colors"
          >
            <FileSpreadsheet className="w-3.5 h-3.5" />
            <span>Export Excel (.xlsx)</span>
          </button>

          <button
            id="export-csv-btn"
            type="button"
            onClick={handleExportCSV}
            className="inline-flex items-center gap-2 px-3.5 py-2 bg-slate-800 text-white rounded-lg text-xs font-bold hover:bg-slate-900 shadow-sm transition-colors"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Export CSV</span>
          </button>

          <button
            id="export-pdf-btn"
            type="button"
            onClick={handleExportPDF}
            className="inline-flex items-center gap-2 px-3.5 py-2 bg-rose-600 text-white rounded-lg text-xs font-bold hover:bg-rose-700 shadow-sm transition-colors"
          >
            <FileText className="w-3.5 h-3.5" />
            <span>Download PDF</span>
          </button>
        </div>
      </div>

      {/* Filter Controls */}
      <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
          <div>
            <label className="block text-[11px] font-semibold text-slate-600 mb-1">From Date</label>
            <input
              type="date"
              value={startDate}
              onChange={e => setStartDate(e.target.value)}
              className="w-full text-xs px-2.5 py-1.5 border border-slate-300 rounded-lg bg-slate-50"
            />
          </div>

          <div>
            <label className="block text-[11px] font-semibold text-slate-600 mb-1">To Date</label>
            <input
              type="date"
              value={endDate}
              onChange={e => setEndDate(e.target.value)}
              className="w-full text-xs px-2.5 py-1.5 border border-slate-300 rounded-lg bg-slate-50"
            />
          </div>

          <div>
            <label className="block text-[11px] font-semibold text-slate-600 mb-1">Shift</label>
            <select
              value={shift}
              onChange={e => setShift(e.target.value)}
              className="w-full text-xs px-2.5 py-1.5 border border-slate-300 rounded-lg bg-white"
            >
              <option value="ALL">ALL Shifts</option>
              <option value="A">Shift A</option>
              <option value="B">Shift B</option>
            </select>
          </div>

          <div>
            <label className="block text-[11px] font-semibold text-slate-600 mb-1">Furnace</label>
            <select
              value={furnace}
              onChange={e => setFurnace(e.target.value)}
              className="w-full text-xs px-2.5 py-1.5 border border-slate-300 rounded-lg bg-white"
            >
              <option value="ALL">ALL Furnaces</option>
              <option value="F-1">Furnace 1</option>
              <option value="F-2">Furnace 2</option>
            </select>
          </div>

          <div>
            <label className="block text-[11px] font-semibold text-slate-600 mb-1">GDC Machine</label>
            <select
              value={gdc}
              onChange={e => setGdc(e.target.value)}
              className="w-full text-xs px-2.5 py-1.5 border border-slate-300 rounded-lg bg-white"
            >
              <option value="ALL">ALL Machines</option>
              {gdcMachines.map(g => (
                <option key={g.gdc_id} value={g.gdc_id}>
                  {g.gdc_code}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-[11px] font-semibold text-slate-600 mb-1">Model</label>
            <select
              value={model}
              onChange={e => setModel(e.target.value)}
              className="w-full text-xs px-2.5 py-1.5 border border-slate-300 rounded-lg bg-white"
            >
              <option value="ALL">ALL Models</option>
              {models.map(m => (
                <option key={m.model_id} value={m.model_code}>
                  {m.model_code}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Preview Table */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="p-4 border-b border-slate-200 bg-slate-50/50 flex items-center justify-between">
          <h3 className="text-sm font-bold text-slate-900">Filtered Report Data ({records.length} records)</h3>
          <span className="text-xs text-slate-500 font-mono">Ready for Export</span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="bg-slate-100 text-slate-700 font-semibold text-[11px] border-b border-slate-200">
                <th className="py-2.5 px-3">Date</th>
                <th className="py-2.5 px-3">Shift</th>
                <th className="py-2.5 px-3">Hour Slot</th>
                <th className="py-2.5 px-3">Supervisor</th>
                <th className="py-2.5 px-3">GDC</th>
                <th className="py-2.5 px-3">Furnace</th>
                <th className="py-2.5 px-3">Model</th>
                <th className="py-2.5 px-3 text-right">Plan</th>
                <th className="py-2.5 px-3 text-right">Actual</th>
                <th className="py-2.5 px-3 text-right">Ach %</th>
                <th className="py-2.5 px-3 text-right">B/D (m)</th>
                <th className="py-2.5 px-3">Remarks</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {records.slice(0, 25).map(r => (
                <tr key={r.record_id} className="hover:bg-slate-50">
                  <td className="py-2 px-3 font-mono">{r.date}</td>
                  <td className="py-2 px-3 font-bold">Shift {r.shift}</td>
                  <td className="py-2 px-3 font-mono">{r.hour_start} - {r.hour_end}</td>
                  <td className="py-2 px-3 text-slate-600">{r.supervisor}</td>
                  <td className="py-2 px-3 font-bold text-slate-900">{r.gdc_machine}</td>
                  <td className="py-2 px-3 text-slate-600">{r.furnace}</td>
                  <td className="py-2 px-3 font-mono text-blue-700">{r.model}</td>
                  <td className="py-2 px-3 text-right font-mono">{r.planned_qty}</td>
                  <td className="py-2 px-3 text-right font-mono font-bold text-emerald-700">{r.actual_qty}</td>
                  <td className="py-2 px-3 text-right font-mono">{r.achievement_pct}%</td>
                  <td className="py-2 px-3 text-right font-mono text-amber-700">{r.breakdown_min}m</td>
                  <td className="py-2 px-3 text-slate-500">{r.remarks || '-'}</td>
                </tr>
              ))}
              {records.length === 0 && (
                <tr>
                  <td colSpan={12} className="py-8 text-center text-slate-400">
                    No production records found for the selected export filters.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
          {records.length > 25 && (
            <div className="p-3 bg-slate-50 text-center text-xs text-slate-500 border-t border-slate-200">
              Showing first 25 of {records.length} records. The full dataset is included in Excel, CSV, and PDF exports.
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
