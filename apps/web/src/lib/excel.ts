type CellValue = string | number | boolean | null | undefined

export interface ExcelSheetDefinition {
  name: string
  columns: string[]
  rows: CellValue[][]
}

function sanitizeSheetName(name: string) {
  return name.replace(/[\\/*?:[\]]/g, '').slice(0, 31) || 'Hoja'
}

function escapeXml(value: CellValue) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;')
}

function inferType(value: CellValue) {
  if (typeof value === 'number') return 'Number'
  if (typeof value === 'boolean') return 'String'
  return 'String'
}

function buildWorksheetXml(sheet: ExcelSheetDefinition) {
  const headerRow = `<Row ss:StyleID="header">${sheet.columns
    .map((column) => `<Cell><Data ss:Type="String">${escapeXml(column)}</Data></Cell>`)
    .join('')}</Row>`

  const dataRows = sheet.rows
    .map((row) => `<Row>${row
      .map((value) => `<Cell><Data ss:Type="${inferType(value)}">${escapeXml(value)}</Data></Cell>`)
      .join('')}</Row>`)
    .join('')

  return `
    <Worksheet ss:Name="${escapeXml(sanitizeSheetName(sheet.name))}">
      <Table>
        ${headerRow}
        ${dataRows}
      </Table>
    </Worksheet>
  `
}

function triggerBlobDownload(blob: Blob, filename: string) {
  const url = window.URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = filename
  document.body.appendChild(anchor)
  anchor.click()
  window.URL.revokeObjectURL(url)
  document.body.removeChild(anchor)
}

export async function downloadExcelWorkbook(filename: string, sheets: ExcelSheetDefinition[]) {
  const workbookXml = `<?xml version="1.0"?>
  <?mso-application progid="Excel.Sheet"?>
  <Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet"
    xmlns:o="urn:schemas-microsoft-com:office:office"
    xmlns:x="urn:schemas-microsoft-com:office:excel"
    xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet"
    xmlns:html="http://www.w3.org/TR/REC-html40">
    <Styles>
      <Style ss:ID="Default" ss:Name="Normal">
        <Alignment ss:Vertical="Center"/>
      </Style>
      <Style ss:ID="header">
        <Font ss:Bold="1" ss:Color="#FFFFFF"/>
        <Interior ss:Color="#1F2937" ss:Pattern="Solid"/>
      </Style>
    </Styles>
    ${sheets.map(buildWorksheetXml).join('')}
  </Workbook>`

  const blob = new Blob([workbookXml], { type: 'application/vnd.ms-excel;charset=utf-8;' })
  triggerBlobDownload(blob, filename.endsWith('.xls') ? filename : filename.replace(/\.xlsx$/i, '.xls'))
}
