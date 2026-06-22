import { useState } from 'react'
import { downloadCsv } from '../lib/exportCsv'
import { downloadReportPng } from '../lib/exportReportPng'
import { downloadReportPdf } from '../lib/exportReportPdf'

type ExportFormat = 'csv' | 'png' | 'pdf'

export function useReportExport() {
  const [exporting, setExporting] = useState<string | null>(null)

  const exportCsv = async (_id: string, rows: string[][], headers: string[], filename: string) => {
    downloadCsv(rows, headers, filename)
  }

  const exportPng = async (id: string, opts: {
    title: string
    subtitle: string
    columns: string[]
    rows: (string | number)[][]
    filename: string
  }) => {
    setExporting(id)
    try {
      await downloadReportPng(opts)
    } finally {
      setExporting(null)
    }
  }

  const exportPdf = async (id: string, opts: {
    title: string
    subtitle: string
    columns: string[]
    rows: (string | number)[][]
    filename: string
  }) => {
    setExporting(`${id}-pdf`)
    try {
      await downloadReportPdf(opts)
    } finally {
      setExporting(null)
    }
  }

  const isExporting = (id: string, format: ExportFormat) => {
    if (format === 'pdf') return exporting === `${id}-pdf`
    return exporting === id
  }

  return { exporting, exportCsv, exportPng, exportPdf, isExporting }
}