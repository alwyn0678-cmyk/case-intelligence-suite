import { useState, useCallback } from 'react';
import { Sidebar } from './components/layout/Sidebar';
import { UploadPage } from './pages/UploadPage';
import { SummaryPage } from './pages/SummaryPage';
import { IssuePage } from './pages/IssuePage';
import { CustomerPage } from './pages/CustomerPage';
import { TransporterPage } from './pages/TransporterPage';
import { CustomsPage } from './pages/CustomsPage';
import { AreaPage } from './pages/AreaPage';
import { PredictivePage } from './pages/PredictivePage';
import { ActionPage } from './pages/ActionPage';
import { DrilldownPage } from './pages/DrilldownPage';
import { ExplorerPage } from './pages/ExplorerPage';
import { ControlTowerPage } from './pages/ControlTowerPage';
import { exportToExcel } from './lib/exportExcel';
import { exportToPdf } from './lib/exportPdf';
import type { ViewId } from './types';
import type { AnalysisResult } from './types/analysis';

export default function App() {
  const [view, setView]         = useState<ViewId>('upload');
  const [analysis, setAnalysis] = useState<AnalysisResult | null>(null);
  const [exporting, setExporting] = useState(false);

  const handleAnalyze = useCallback((result: AnalysisResult) => {
    setAnalysis(result);
    setView('summary');
  }, []);

  const handleExcelExport = useCallback(() => {
    if (analysis) exportToExcel(analysis);
  }, [analysis]);

  const handlePdfExport = useCallback(async () => {
    if (!analysis || exporting) return;
    setExporting(true);
    try { await exportToPdf(analysis); }
    finally { setExporting(false); }
  }, [analysis, exporting]);

  const renderPage = () => {
    switch (view) {
      case 'upload':       return <UploadPage onAnalyze={handleAnalyze} />;
      case 'summary':        return analysis ? <SummaryPage analysis={analysis} />        : null;
      case 'control-tower': return analysis ? <ControlTowerPage analysis={analysis} /> : null;
      case 'issues':       return analysis ? <IssuePage analysis={analysis} />        : null;
      case 'customers':    return analysis ? <CustomerPage analysis={analysis} />     : null;
      case 'transporters': return analysis ? <TransporterPage analysis={analysis} />  : null;
      case 'customs':      return analysis ? <CustomsPage analysis={analysis} />      : null;
      case 'areas':        return analysis ? <AreaPage analysis={analysis} />         : null;
      case 'predictive':   return analysis ? <PredictivePage analysis={analysis} />   : null;
      case 'actions':      return analysis ? <ActionPage analysis={analysis} />       : null;
      case 'drilldown':    return analysis ? <DrilldownPage analysis={analysis} />    : null;
      case 'explorer':     return analysis ? <ExplorerPage analysis={analysis} />     : null;
      default:             return <UploadPage onAnalyze={handleAnalyze} />;
    }
  };

  return (
    <div className="flex h-full bg-[#0f1014]">
      <Sidebar
        current={view}
        onChange={setView}
        hasData={analysis !== null}
        onExcelExport={handleExcelExport}
        onPdfExport={handlePdfExport}
      />
      <main className="ml-[220px] flex-1 min-h-full overflow-y-auto">
        {renderPage()}
      </main>
    </div>
  );
}
