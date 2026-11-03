// The actual PCAP Analysis UI lives in PcapAnalysisFrame, mounted once in
// App.tsx outside of <Routes> so navigating away and back doesn't tear down
// the embedded tool's iframe (and whatever capture an analyst has loaded in
// it). This route exists only so ProtectedRoute can gate /pcap-analysis and
// direct links to it still work.
export default function PcapAnalysis() {
  return null;
}
