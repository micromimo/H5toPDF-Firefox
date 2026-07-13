const DEFAULT_OPTIONS = {
  pixelDensity: 2,
  pageWidth: 595,
  pageHeight: 842,
  margin: 20,
  quality: 0.95,
  maxHeight: 20000
};

const jsPDF = self.jspdf?.jsPDF;

async function generatePDF(options) {
  const config = { ...DEFAULT_OPTIONS, ...options };
  
  try {
    const tabs = await browser.tabs.query({ active: true, currentWindow: true });
    const tab = tabs[0];
    
    if (!tab) {
      throw new Error('No active tab found');
    }
    
    const response = await browser.tabs.sendMessage(tab.id, {
      type: 'CAPTURE_DOM',
      options: config
    });

    if (!response || !response.dataUrl) {
      throw new Error(response?.error || 'Failed to capture DOM');
    }

    const { dataUrl, width, height } = response;
    
    const pdfData = await createPDF(dataUrl, width, height, config);
    
    await browser.downloads.download({
      url: pdfData,
      filename: `h5topdf-${Date.now()}.pdf`,
      saveAs: true
    });

    return { success: true };
  } catch (error) {
    console.error('PDF generation failed:', error);
    return { success: false, error: error.message };
  }
}

async function createPDF(dataUrl, canvasWidth, canvasHeight, config) {
  if (typeof jsPDF === 'undefined') {
    throw new Error('jsPDF library not loaded');
  }
  
  const pageWidth = config.pageWidth;
  const pageHeight = config.pageHeight;
  const margin = config.margin;
  const contentWidth = pageWidth - margin * 2;
  const contentHeight = pageHeight - margin * 2;
  
  const scale = contentWidth / canvasWidth;
  const scaledHeight = canvasHeight * scale;
  
  const pdf = new jsPDF({
    orientation: 'portrait',
    unit: 'pt',
    format: [pageWidth, pageHeight]
  });
  
  const pages = Math.ceil(scaledHeight / contentHeight);
  
  for (let i = 0; i < pages; i++) {
    if (i > 0) {
      pdf.addPage();
    }
    
    const yOffset = -i * contentHeight;
    
    pdf.addImage(
      dataUrl,
      'PNG',
      margin,
      margin + yOffset,
      contentWidth,
      scaledHeight
    );
  }
  
  const blob = pdf.output('blob');
  const blobUrl = URL.createObjectURL(blob);
  
  return blobUrl;
}

browser.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === 'GENERATE_PDF') {
    generatePDF(message.options)
      .then(result => sendResponse(result))
      .catch(error => sendResponse({ success: false, error: error.message }));
    return true;
  }
  
  if (message.type === 'GET_DEFAULT_OPTIONS') {
    sendResponse(DEFAULT_OPTIONS);
    return true;
  }
});