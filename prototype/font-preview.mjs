const sample = document.querySelector('#sample');
const size = document.querySelector('#font-size');
const label = document.querySelector('#size-label');
const styleButton = document.querySelector('#font-style');
styleButton.addEventListener('click', () => {
  const bold = styleButton.getAttribute('aria-pressed') !== 'true';
  styleButton.setAttribute('aria-pressed', String(bold));
  sample.style.fontWeight = bold ? '700' : '400';
});
size.addEventListener('input', () => {
  sample.style.fontSize = `${size.value}px`;
  label.value = `${size.value} px`;
});
