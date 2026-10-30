// A user can navigate before all deferred enhancements arrive on a slow connection.
// Replay only the currently visible destination once the ordered scripts are ready.
(() => {
  window.NovaUIReady=true;
  window.dispatchEvent(new Event('nova:ui-ready'));
  const page=document.querySelector('.page:not(.hidden)')?.id;
  if(page)Promise.resolve(window.handleFunctionalPageOpen?.(page)).catch(error=>console.warn('Initial page:',error.message));
})();
