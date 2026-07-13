const PAGE_FORMATS = {
  'A4': { width: 595, height: 842 },
  'Letter': { width: 612, height: 792 },
  'A3': { width: 842, height: 1190 },
  'Legal': { width: 612, height: 1008 }
};

document.addEventListener('DOMContentLoaded', async () => {
  const pageFormatSelect = document.getElementById('pageFormat');
  const pixelDensitySelect = document.getElementById('pixelDensity');
  const marginInput = document.getElementById('margin');
  const qualityInput = document.getElementById('quality');
  const maxHeightInput = document.getElementById('maxHeight');
  const generateBtn = document.getElementById('generateBtn');
  const progress = document.getElementById('progress');
  const error = document.getElementById('error');
  const errorText = error.querySelector('.error-text');
  
  const qualityValue = document.querySelector('.range-value');
  
  qualityInput.addEventListener('input', (e) => {
    qualityValue.textContent = `${e.target.value}%`;
  });
  
  async function loadOptions() {
    try {
      const response = await browser.runtime.sendMessage({ type: 'GET_DEFAULT_OPTIONS' });
      if (response) {
        pixelDensitySelect.value = response.pixelDensity || 2;
        marginInput.value = response.margin || 20;
        qualityInput.value = (response.quality * 100) || 95;
        maxHeightInput.value = response.maxHeight || 20000;
        qualityValue.textContent = `${qualityInput.value}%`;
        
        for (const [format, dimensions] of Object.entries(PAGE_FORMATS)) {
          if (dimensions.width === response.pageWidth && dimensions.height === response.pageHeight) {
            pageFormatSelect.value = format;
            break;
          }
        }
      }
    } catch (err) {
      console.error('Failed to load options:', err);
    }
  }
  
  await loadOptions();
  
  generateBtn.addEventListener('click', async () => {
    const format = PAGE_FORMATS[pageFormatSelect.value] || PAGE_FORMATS['A4'];
    
    const options = {
      pixelDensity: parseInt(pixelDensitySelect.value),
      pageWidth: format.width,
      pageHeight: format.height,
      margin: parseInt(marginInput.value),
      quality: parseInt(qualityInput.value) / 100,
      maxHeight: parseInt(maxHeightInput.value)
    };
    
    generateBtn.disabled = true;
    generateBtn.style.display = 'none';
    progress.style.display = 'block';
    error.style.display = 'none';
    
    try {
      const result = await browser.runtime.sendMessage({
        type: 'GENERATE_PDF',
        options: options
      });
      
      if (!result.success) {
        throw new Error(result.error || '生成失败');
      }
      
      setTimeout(() => {
        progress.style.display = 'none';
        generateBtn.style.display = 'flex';
        generateBtn.disabled = false;
      }, 500);
      
    } catch (err) {
      progress.style.display = 'none';
      error.style.display = 'flex';
      errorText.textContent = err.message;
      
      setTimeout(() => {
        error.style.display = 'none';
        generateBtn.style.display = 'flex';
        generateBtn.disabled = false;
      }, 5000);
    }
  });
});