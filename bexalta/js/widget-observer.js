(function(){
  const widgetInstances = new Map();
  window.__bxWidgetInstances = widgetInstances;

  const observer = new IntersectionObserver((entries)=>{
    entries.forEach(entry=>{
      const widget = entry.target;
      const id = widget.dataset.widgetId;
      if(!id) return;
      const inst = widgetInstances.get(id);
      if(!inst) return;
      if(entry.isIntersecting){inst.startAnim();}
      else{inst.stopAnim();}
    });
  },{threshold:0.05});

  window.__bxObserveWidget = function(el,inst){
    const id = 'bx-'+Math.random().toString(36).slice(2,9);
    el.dataset.widgetId = id;
    widgetInstances.set(id,inst);
    observer.observe(el);
  };
})();
