if (!window.__h5topdfInjected) {
  window.__h5topdfInjected = true;

  function setupCrossOriginImages() {
    const images = document.querySelectorAll('img');
    images.forEach(img => {
      if (!img.crossOrigin) {
        img.crossOrigin = 'anonymous';
      }
    });
    
    const svgs = document.querySelectorAll('svg');
    svgs.forEach(svg => {
      const foreignObjects = svg.querySelectorAll('foreignObject');
      foreignObjects.forEach(fo => {
        const imgs = fo.querySelectorAll('img');
        imgs.forEach(img => {
          if (!img.crossOrigin) {
            img.crossOrigin = 'anonymous';
          }
        });
      });
    });
  }

  function stabilizeReactVue() {
    return new Promise(resolve => {
      setTimeout(() => {
        const reactRoots = document.querySelectorAll('[data-reactroot], [data-react-root], #root');
        reactRoots.forEach(root => {
          root.style.transform = 'none';
        });
        
        const vueRoots = document.querySelectorAll('[data-v-app], #app');
        vueRoots.forEach(root => {
          root.style.transform = 'none';
        });
        
        const virtualScrollers = document.querySelectorAll('.virtual-scroller, [data-virtual-scroll], .infinite-scroll');
        virtualScrollers.forEach(scroller => {
          scroller.style.overflow = 'visible';
          scroller.style.height = 'auto';
        });
        
        resolve();
      }, 1000);
    });
  }

  function hideModalAndOverlay(node) {
    const modals = node.querySelectorAll('.modal, .modal-overlay, .popup, .toast, .notification');
    modals.forEach(el => {
      el.style.display = 'none';
    });
    
    const fixedElements = node.querySelectorAll('header, footer, [style*="position: fixed"], [style*="position:sticky"]');
    fixedElements.forEach(el => {
      el.style.position = 'relative';
    });
  }

  async function captureDOM(options) {
    if (!window.modernScreenshot || !window.modernScreenshot.toCanvas) {
      throw new Error('modern-screenshot library not loaded');
    }
    
    try {
      await stabilizeReactVue();
      
      setupCrossOriginImages();
      
      const container = document.body;
      const rect = container.getBoundingClientRect();
      
      const targetHeight = Math.min(rect.height, options.maxHeight || 20000);
      
      const scrollTop = window.scrollY;
      const scrollLeft = window.scrollX;
      
      window.scrollTo(0, 0);
      
      const canvas = await window.modernScreenshot.toCanvas(container, {
        backgroundColor: '#ffffff',
        scale: options.pixelDensity || 2,
        scrollY: 0,
        height: targetHeight,
        onCloneNode: (node, cloned) => {
          if (isElementNode(cloned)) {
            hideModalAndOverlay(cloned);
          }
        }
      });
      
      window.scrollTo(scrollLeft, scrollTop);
      
      const dataUrl = canvas.toDataURL('image/png', options.quality || 0.95);
      
      return {
        dataUrl,
        width: canvas.width,
        height: canvas.height
      };
    } catch (error) {
      console.error('DOM capture failed:', error);
      throw error;
    }
  }

  function isElementNode(node) {
    return node && node.nodeType === Node.ELEMENT_NODE;
  }

  browser.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.type === 'CAPTURE_DOM') {
      captureDOM(message.options)
        .then(result => sendResponse(result))
        .catch(error => sendResponse({ error: error.message }));
      return true;
    }
  });
}