/**
 * Eurocircuits PCB Design Classification Calculator - Logical Engine
 * Standards: Eurocircuits Pattern Class (3-9) and Drill Class (A-E)
 * Author: Antigravity PCB Tools
 */

// --- Global Constants & Unit Conversion Definitions ---
const MILS_TO_MM = 0.0254;
const MM_TO_MILS = 1 / 0.0254;

// Eurocircuits Pattern Classes (Class 3 to Class 9) in mm
const EURO_PATTERN_RULES = {
  3: { minOAR: 0.200, minIAR: 0.200, minOTW: 0.250, minIPI: 0.275 },
  4: { minOAR: 0.150, minIAR: 0.150, minOTW: 0.200, minIPI: 0.225 },
  5: { minOAR: 0.150, minIAR: 0.150, minOTW: 0.175, minIPI: 0.225 },
  6: { minOAR: 0.125, minIAR: 0.125, minOTW: 0.150, minIPI: 0.200 },
  7: { minOAR: 0.125, minIAR: 0.125, minOTW: 0.125, minIPI: 0.200 },
  8: { minOAR: 0.100, minIAR: 0.125, minOTW: 0.100, minIPI: 0.200 },
  9: { minOAR: 0.100, minIAR: 0.100, minOTW: 0.090, minIPI: 0.200 }
};

// Eurocircuits Drill Classes (Class A to Class E) in mm
const EURO_DRILL_RULES = {
  'A': { minPTH: 0.50, minNPTH: 0.60 },
  'B': { minPTH: 0.35, minNPTH: 0.45 },
  'C': { minPTH: 0.25, minNPTH: 0.35 },
  'D': { minPTH: 0.15, minNPTH: 0.25 },
  'E': { minPTH: 0.10, minNPTH: 0.20 }
};

// Base Copper Thickness constraints in um: max allowed Pattern Class
const COPPER_CLASS_LIMITS = {
  12: 9,
  18: 9,
  35: 6,
  70: 4,
  105: 3
};

// --- App State ---
let state = {
  unit: 'mm', // 'mm' or 'mils'
  patternClass: 6, // 3 to 9 (default 6)
  drillClass: 'C', // A to E (default C)
  
  // Design metrics stored in active unit
  finishedHole: 0.80, // Calculated default for round lead of 0.60mm (0.60 + 0.20 for Level B = 0.80mm)
  drillSize: 0.90, // Calculated (TOOLSIZE = finishedHole + 0.10mm for PTH)
  padDiameter: 1.40, // default pad diameter to support Class 6 (0.90 + 2*0.125 = 1.15mm, set to 1.40mm for clearance margin)
  boardThickness: 1.60,
  
  holeType: 'PTH', // 'PTH' or 'NPTH'
  copperWeight: 35, // base Cu in um (12, 18, 35, 70, 105)
  layerType: 'external', // 'external' or 'internal'
  activeView: 'top', // 'top' or 'cross'
  
  // Component Lead parameters
  leadShape: 'round', // 'round' or 'rectangular'
  leadDiameter: 0.60, // default round pin size
  leadWidth: 0.50, // default rectangular pin width
  leadThickness: 0.50, // default rectangular pin thickness
  ipcLevel: 'B', // 'A', 'B', 'C'
  autoCalcHole: true
};

// --- DOM References ---
const DOM = {
  unitMm: document.getElementById('unit-mm'),
  unitMils: document.getElementById('unit-mils'),
  
  holeType: document.getElementById('hole-type'),
  finishedHole: document.getElementById('finished-hole'),
  drillSize: document.getElementById('drill-size'),
  padDiameter: document.getElementById('pad-diameter'),
  padSlider: document.getElementById('pad-slider'),
  boardThickness: document.getElementById('board-thickness'),
  copperWeight: document.getElementById('copper-weight'),
  layerType: document.getElementById('layer-type'),
  
  // Component Lead DOM Elements
  leadShape: document.getElementById('lead-shape'),
  leadDiameter: document.getElementById('lead-diameter'),
  leadWidth: document.getElementById('lead-width'),
  leadThickness: document.getElementById('lead-thickness'),
  ipcLevel: document.getElementById('ipc-level'),
  autoCalcHole: document.getElementById('auto-calc-hole'),
  blockLeadDia: document.getElementById('block-lead-dia'),
  blockLeadRect: document.getElementById('block-lead-rect'),
  
  // Navigation tabs
  tabBtnTop: document.getElementById('tab-btn-top'),
  tabBtnCross: document.getElementById('tab-btn-cross'),
  containerVizTop: document.getElementById('container-viz-top'),
  containerVizCross: document.getElementById('container-viz-cross'),
  
  // Hero Display Elements
  mainResultsCard: document.getElementById('main-results-card'),
  ipcComplianceBadge: document.getElementById('ipc-compliance-badge'),
  valWorstCase: document.getElementById('val-worst-case'),
  unitWorstCase: document.getElementById('unit-worst-case'),
  valNominalRing: document.getElementById('val-nominal-ring'),
  valRequiredMin: document.getElementById('val-required-min'),
  valSafetyMargin: document.getElementById('val-safety-margin'),
  oarLabel: document.getElementById('oar-label'),
  
  // Gauge Display Elements
  gaugeNumericalVal: document.getElementById('gauge-numerical-val'),
  gaugeIndicatorPin: document.getElementById('gauge-indicator-pin'),
  gaugeAxisLabels: document.getElementById('gauge-axis-labels'),
  
  // Analytical Grid Elements
  valPadRatio: document.getElementById('val-pad-ratio'),
  valCopperArea: document.getElementById('val-copper-area'),
  valPlatingThickness: document.getElementById('val-plating-thickness'),
  valTangencyStatus: document.getElementById('val-tangency-status'),
  valMinPadReq: document.getElementById('val-min-pad-req'),
  valTrackWidth: document.getElementById('val-track-width'),
  valDrillClass: document.getElementById('val-drill-class'),
  
  cardBreakoutRisk: document.getElementById('card-breakout-risk'),
  cardPatternRes: document.getElementById('card-pattern-res'),
  cardDrillCompat: document.getElementById('card-drill-compat'),
  cardCopperThick: document.getElementById('card-copper-thick'),
  cardTangency: document.getElementById('card-tangency'),
  cardMinPad: document.getElementById('card-min-pad'),
  
  // Tables
  euroPatternTable: document.getElementById('euro-pattern-table'),
  euroDrillTable: document.getElementById('euro-drill-table'),
  
  // Recommendation list
  recommendationList: document.getElementById('recommendation-list-container'),
  
};

// --- Math & Calculation Helper Functions ---

function toActiveUnit(valInMm) {
  return state.unit === 'mils' ? valInMm * MM_TO_MILS : valInMm;
}

function toMm(valInActiveUnit) {
  return state.unit === 'mils' ? valInActiveUnit * MILS_TO_MM : valInActiveUnit;
}

function formatValue(val, forceMils = false) {
  const isMils = forceMils || state.unit === 'mils';
  return val.toFixed(isMils ? 2 : 3) + ' ' + (isMils ? 'mils' : 'mm');
}

/**
 * Math Engine Calculations (all processing in mm internally)
 */
function getCalculatedMetrics() {
  const finishedHole_mm = toMm(state.finishedHole);
  const padDiameter_mm = toMm(state.padDiameter);
  const boardThickness_mm = toMm(state.boardThickness);
  
  // 1. TOOLSIZE (Drill size)
  // PTH: Finished Hole + 0.10 mm (4 mils)
  // NPTH: Finished Hole
  let toolsize_mm = finishedHole_mm;
  if (state.holeType === 'PTH') {
    toolsize_mm += 0.10;
  }
  
  // 2. Design OAR / IAR (Nominal)
  // OAR = (Pad Diameter - TOOLSIZE) / 2
  const designOar_mm = (padDiameter_mm - toolsize_mm) / 2;
  const designIar_mm = (padDiameter_mm - toolsize_mm) / 2;
  
  // 3. Target Class Requirements
  const targetPatRule = EURO_PATTERN_RULES[state.patternClass];
  const targetMinOar_mm = targetPatRule.minOAR;
  const targetMinIar_mm = targetPatRule.minIAR;
  
  const requiredMin_mm = state.layerType === 'external' ? targetMinOar_mm : targetMinIar_mm;
  const actualRing_mm = state.layerType === 'external' ? designOar_mm : designIar_mm;
  
  // 4. Safety Margin
  const safetyMargin_mm = actualRing_mm - requiredMin_mm;
  
  // 5. Aspect Ratio (AR) = Board Thickness / TOOLSIZE
  const aspectRatio = toolsize_mm > 0 ? (boardThickness_mm / toolsize_mm) : 0;
  
  // 6. Qualify for Pattern Classes (3 to 9)
  const patternClassQualify = {};
  for (let c = 3; c <= 9; c++) {
    const rule = EURO_PATTERN_RULES[c];
    const compliesOar = designOar_mm >= rule.minOAR;
    const compliesIar = designIar_mm >= rule.minIAR;
    
    // Check if the base copper thickness allows this class
    const maxClassForCopper = COPPER_CLASS_LIMITS[state.copperWeight];
    const copperOk = c <= maxClassForCopper;
    
    if (compliesOar && compliesIar && copperOk) {
      patternClassQualify[c] = 'pass';
    } else if (compliesOar && compliesIar && !copperOk) {
      patternClassQualify[c] = 'copper-limit';
    } else {
      patternClassQualify[c] = 'fail';
    }
  }
  
  // 7. Qualify for Drill Classes (A to E)
  const drillClassQualify = {};
  for (const key of ['A', 'B', 'C', 'D', 'E']) {
    const rule = EURO_DRILL_RULES[key];
    const minHole = state.holeType === 'PTH' ? rule.minPTH : rule.minNPTH;
    // Compare finished hole size in mm against the class limit
    // Round to 3 decimal places to avoid floating point precision issues
    if (Math.round(finishedHole_mm * 1000) >= Math.round(minHole * 1000)) {
      drillClassQualify[key] = 'pass';
    } else {
      drillClassQualify[key] = 'fail';
    }
  }
  
  // 8. Minimum Pad required to meet active Pattern Class
  // Pad = TOOLSIZE + 2 * Required_Min
  const minPadReq_mm = toolsize_mm + 2 * requiredMin_mm;
  
  return {
    toolsize_mm,
    designOar_mm,
    designIar_mm,
    requiredMin_mm,
    actualRing_mm,
    safetyMargin_mm,
    aspectRatio,
    patternClassQualify,
    drillClassQualify,
    minPadReq_mm
  };
}

// --- Dynamic Event Handlers & Sync ---

function handleFinishedHoleInput(val) {
  state.finishedHole = parseFloat(val) || 0;
  
  // Update calculated TOOLSIZE
  const results = getCalculatedMetrics();
  state.drillSize = toActiveUnit(results.toolsize_mm);
  DOM.drillSize.value = state.drillSize.toFixed(state.unit === 'mils' ? 2 : 3);
  
  // Auto-adjust Pad Diameter to comply with selected Pattern Class
  state.padDiameter = toActiveUnit(results.minPadReq_mm);
  DOM.padDiameter.value = state.padDiameter.toFixed(state.unit === 'mils' ? 2 : 3);
  DOM.padSlider.value = state.padDiameter;
}

function handlePadInput(val) {
  state.padDiameter = parseFloat(val) || 0;
  DOM.padSlider.value = state.padDiameter;
}

function handlePadSliderInput(val) {
  state.padDiameter = parseFloat(val);
  const precision = state.unit === 'mils' ? 2 : 3;
  DOM.padDiameter.value = state.padDiameter.toFixed(precision);
  updateCalculations();
}

function handleBoardThicknessInput(val) {
  state.boardThickness = parseFloat(val) || 0;
}

function handleHoleTypeChange(val) {
  state.holeType = val;
  
  // Recalculate drill size
  const results = getCalculatedMetrics();
  state.drillSize = toActiveUnit(results.toolsize_mm);
  DOM.drillSize.value = state.drillSize.toFixed(state.unit === 'mils' ? 2 : 3);
  
  // Auto-adjust Pad Diameter
  state.padDiameter = toActiveUnit(results.minPadReq_mm);
  DOM.padDiameter.value = state.padDiameter.toFixed(state.unit === 'mils' ? 2 : 3);
  DOM.padSlider.value = state.padDiameter;
}

function handleCopperWeightChange(val) {
  state.copperWeight = parseInt(val);
}

function handleLayerTypeChange(val) {
  state.layerType = val;
  
  // Recalculate minimum pad required
  const results = getCalculatedMetrics();
  state.padDiameter = toActiveUnit(results.minPadReq_mm);
  DOM.padDiameter.value = state.padDiameter.toFixed(state.unit === 'mils' ? 2 : 3);
  DOM.padSlider.value = state.padDiameter;
}

function handleUnitChange(newUnit) {
  if (state.unit === newUnit) return;
  
  const conversionFactor = newUnit === 'mils' ? MM_TO_MILS : MILS_TO_MM;
  
  // Convert state values
  state.finishedHole = state.finishedHole * conversionFactor;
  state.drillSize = state.drillSize * conversionFactor;
  state.padDiameter = state.padDiameter * conversionFactor;
  state.boardThickness = state.boardThickness * conversionFactor;
  
  // Convert lead state values
  state.leadDiameter = state.leadDiameter * conversionFactor;
  state.leadWidth = state.leadWidth * conversionFactor;
  state.leadThickness = state.leadThickness * conversionFactor;
  
  state.unit = newUnit;
  
  // Sync input fields
  const precision = newUnit === 'mils' ? 2 : 3;
  DOM.finishedHole.value = state.finishedHole.toFixed(precision);
  DOM.drillSize.value = state.drillSize.toFixed(precision);
  DOM.padDiameter.value = state.padDiameter.toFixed(precision);
  DOM.boardThickness.value = state.boardThickness.toFixed(newUnit === 'mils' ? 1 : 2);
  
  DOM.leadDiameter.value = state.leadDiameter.toFixed(precision);
  DOM.leadWidth.value = state.leadWidth.toFixed(precision);
  DOM.leadThickness.value = state.leadThickness.toFixed(precision);
  
  // Update step values
  const stepVal = newUnit === 'mils' ? '1' : '0.05';
  DOM.finishedHole.setAttribute('step', stepVal);
  DOM.padDiameter.setAttribute('step', stepVal);
  DOM.boardThickness.setAttribute('step', newUnit === 'mils' ? '5' : '0.1');
  
  DOM.leadDiameter.setAttribute('step', stepVal);
  DOM.leadWidth.setAttribute('step', stepVal);
  DOM.leadThickness.setAttribute('step', stepVal);
  
  // Update slider limits
  DOM.padSlider.min = (toActiveUnit(0.15)).toFixed(1);
  DOM.padSlider.max = (toActiveUnit(3.5)).toFixed(1);
  DOM.padSlider.value = state.padDiameter;
  DOM.padSlider.step = newUnit === 'mils' ? '0.5' : '0.01';
  
  // Update labels
  document.querySelectorAll('.unit-indicator').forEach(el => {
    el.textContent = newUnit;
  });
  
  updateCalculations();
}

function selectPatternClass(c) {
  state.patternClass = c;
  
  document.querySelectorAll('.pattern-class-group .class-btn').forEach(btn => {
    const btnClass = parseInt(btn.getAttribute('data-class'));
    const isActive = btnClass === c;
    btn.classList.toggle('active', isActive);
    btn.setAttribute('aria-checked', isActive ? 'true' : 'false');
  });
  
  // Auto-adjust pad to meet class requirements
  const results = getCalculatedMetrics();
  state.padDiameter = toActiveUnit(results.minPadReq_mm);
  
  const precision = state.unit === 'mils' ? 2 : 3;
  DOM.padDiameter.value = state.padDiameter.toFixed(precision);
  DOM.padSlider.value = state.padDiameter;
  
  updateCalculations();
}

function selectDrillClass(key) {
  state.drillClass = key;
  
  document.querySelectorAll('.drill-class-group .class-btn').forEach(btn => {
    const btnClass = btn.getAttribute('data-drill-class');
    const isActive = btnClass === key;
    btn.classList.toggle('active', isActive);
    btn.setAttribute('aria-checked', isActive ? 'true' : 'false');
  });
  
  updateCalculations();
}

// --- Calculation Rendering & Interface Updates ---

function updateCalculations() {
  // Sync state values from inputs
  state.leadShape = DOM.leadShape.value;
  state.leadDiameter = parseFloat(DOM.leadDiameter.value) || 0;
  state.leadWidth = parseFloat(DOM.leadWidth.value) || 0;
  state.leadThickness = parseFloat(DOM.leadThickness.value) || 0;
  state.ipcLevel = DOM.ipcLevel.value;
  state.autoCalcHole = DOM.autoCalcHole.checked;
  state.padDiameter = parseFloat(DOM.padDiameter.value) || 0;
  state.boardThickness = parseFloat(DOM.boardThickness.value) || 0;
  state.holeType = DOM.holeType.value;
  state.copperWeight = parseInt(DOM.copperWeight.value);
  state.layerType = DOM.layerType.value;
  
  // Show/Hide conditional lead input blocks based on shape
  if (state.leadShape === 'round') {
    DOM.blockLeadDia.classList.remove('hidden');
    DOM.blockLeadRect.classList.add('hidden');
  } else {
    DOM.blockLeadDia.classList.add('hidden');
    DOM.blockLeadRect.classList.remove('hidden');
  }
  
  const prevFinishedHole = state.finishedHole;
  
  // Calculate recommended finished hole size if autoCalcHole is active
  if (state.autoCalcHole) {
    let leadSize_mm = 0;
    if (state.leadShape === 'round') {
      leadSize_mm = toMm(state.leadDiameter);
    } else {
      // rectangular pin effective diagonal
      leadSize_mm = Math.sqrt(toMm(state.leadWidth) ** 2 + toMm(state.leadThickness) ** 2);
    }
    
    // IPC-7251 Clearance levels
    let clearance_mm = 0.20; // default standard level B
    if (state.ipcLevel === 'A') clearance_mm = 0.25;
    else if (state.ipcLevel === 'C') clearance_mm = 0.15;
    
    const recFinishedHole_mm = leadSize_mm + clearance_mm;
    const recFinishedHole = toActiveUnit(recFinishedHole_mm);
    
    // Format to match unit precision (3 decimals for mm, 2 for mils)
    const precision = state.unit === 'mils' ? 2 : 3;
    state.finishedHole = parseFloat(recFinishedHole.toFixed(precision));
    
    DOM.finishedHole.value = state.finishedHole.toFixed(precision);
    DOM.finishedHole.disabled = true;
    DOM.finishedHole.style.opacity = '0.6';
    DOM.finishedHole.style.cursor = 'not-allowed';
  } else {
    DOM.finishedHole.disabled = false;
    DOM.finishedHole.style.opacity = '';
    DOM.finishedHole.style.cursor = '';
    state.finishedHole = parseFloat(DOM.finishedHole.value) || 0;
  }
  
  // Auto-update pad diameter to meet the minimum required pad diameter if hole size changed
  let results = getCalculatedMetrics();
  if (state.autoCalcHole && state.finishedHole !== prevFinishedHole) {
    state.padDiameter = toActiveUnit(results.minPadReq_mm);
    const precision = state.unit === 'mils' ? 2 : 3;
    DOM.padDiameter.value = state.padDiameter.toFixed(precision);
    DOM.padSlider.value = state.padDiameter;
    // Re-evaluate metrics with new pad diameter
    results = getCalculatedMetrics();
  }
  
  // Sync calculated drill size (TOOLSIZE) in state
  state.drillSize = toActiveUnit(results.toolsize_mm);
  DOM.drillSize.value = state.drillSize.toFixed(state.unit === 'mils' ? 2 : 3);
  
  // Render results
  renderHeroResults(results);
  renderGauge(results);
  renderAnalyticalGrid(results);
  renderComplianceTables(results);
  renderRecommendations(results);
  
  // Visualizations
  renderSVGTopView(results);
  renderSVGCrossSection(results);
}

function renderHeroResults(res) {
  const activeRing = toActiveUnit(res.actualRing_mm);
  const activeReq = toActiveUnit(res.requiredMin_mm);
  const activeMargin = toActiveUnit(res.safetyMargin_mm);
  
  // 1. OAR/IAR Value
  DOM.valWorstCase.textContent = activeRing.toFixed(state.unit === 'mils' ? 2 : 3);
  DOM.unitWorstCase.textContent = state.unit;
  DOM.oarLabel.textContent = state.layerType === 'external' ? 'Design Annular Ring (OAR)' : 'Design Annular Ring (IAR)';
  
  // 2. Mini metrics
  DOM.valNominalRing.textContent = formatValue(toActiveUnit(res.toolsize_mm));
  DOM.valRequiredMin.textContent = formatValue(activeReq);
  
  // 3. Margin with sign
  const sign = activeMargin >= 0 ? '+' : '';
  DOM.valSafetyMargin.textContent = sign + activeMargin.toFixed(state.unit === 'mils' ? 2 : 3) + ' ' + state.unit;
  
  // 4. Hero Card style state
  let status = 'pass';
  if (res.actualRing_mm < res.requiredMin_mm) {
    status = 'fail';
  } else if (state.patternClass > COPPER_CLASS_LIMITS[state.copperWeight]) {
    status = 'warning';
  }
  
  DOM.mainResultsCard.setAttribute('data-state', status);
  DOM.ipcComplianceBadge.setAttribute('data-state', status);
  DOM.valSafetyMargin.setAttribute('data-state', status);
  
  // Badge text
  if (status === 'pass') {
    DOM.ipcComplianceBadge.textContent = `Pattern Class ${state.patternClass} OK`;
  } else if (status === 'warning') {
    DOM.ipcComplianceBadge.textContent = `Class ${state.patternClass} (Copper limit warning)`;
  } else {
    DOM.ipcComplianceBadge.textContent = `Pattern Class ${state.patternClass} Fail`;
  }
}

function renderGauge(res) {
  const ringValueMm = res.actualRing_mm;
  DOM.gaugeNumericalVal.textContent = formatValue(toActiveUnit(ringValueMm));
  
  // Scale boundaries
  const minScaleMm = -0.05;
  const maxScaleMm = 0.25;
  const scaleRange = maxScaleMm - minScaleMm;
  
  // Axis labels
  const labelsContainer = DOM.gaugeAxisLabels;
  if (state.unit === 'mils') {
    labelsContainer.innerHTML = '<span>-2.0</span><span>0.0</span><span>2.0</span><span>4.0</span><span>6.0</span><span>8.0</span><span>10.0+ mils</span>';
  } else {
    labelsContainer.innerHTML = '<span>-0.05</span><span>0.00</span><span>0.05</span><span>0.10</span><span>0.15</span><span>0.20</span><span>0.25+ mm</span>';
  }
  
  // Map indicator pin
  let percent = ((ringValueMm - minScaleMm) / scaleRange) * 100;
  percent = Math.min(100, Math.max(0, percent));
  DOM.gaugeIndicatorPin.style.left = `${percent}%`;
  
  // Calculate dynamic widths of the gauge zones based on required minimum OAR
  const zoneRed = document.querySelector('.zone-breakout');
  const zoneOrange = document.querySelector('.zone-marginal');
  const zoneGreen = document.querySelector('.zone-good');
  const zoneBlue = document.querySelector('.zone-excellent');
  
  if (zoneRed && zoneOrange && zoneGreen && zoneBlue) {
    const reqMin = res.requiredMin_mm;
    
    // Red (Fail): from minScaleMm to reqMin
    const redWidth = Math.max(0, ((reqMin - minScaleMm) / scaleRange) * 100);
    
    // Orange (Marginal): from reqMin to 1.5 * reqMin
    const orangeWidth = Math.max(0, ((0.5 * reqMin) / scaleRange) * 100);
    
    // Green (Good): from 1.5 * reqMin to 2.5 * reqMin
    const greenWidth = Math.max(0, ((1.0 * reqMin) / scaleRange) * 100);
    
    // Blue (Excellent): remaining
    const blueWidth = Math.max(0, 100 - redWidth - orangeWidth - greenWidth);
    
    zoneRed.style.width = `${redWidth}%`;
    zoneOrange.style.width = `${orangeWidth}%`;
    zoneGreen.style.width = `${greenWidth}%`;
    zoneBlue.style.width = `${blueWidth}%`;
  }
}

function renderAnalyticalGrid(res) {
  // 1. Aspect Ratio
  const ar = res.aspectRatio;
  DOM.valPadRatio.textContent = `${ar.toFixed(2)} : 1`;
  const isArBad = ar > 8;
  DOM.cardBreakoutRisk.setAttribute('data-state', isArBad ? 'fail' : (ar >= 7 ? 'warning' : 'pass'));
  
  // 2. Pattern Resolution
  const targetRule = EURO_PATTERN_RULES[state.patternClass];
  DOM.valTrackWidth.textContent = `${targetRule.minOTW.toFixed(3)} mm`;
  const maxClassCopper = COPPER_CLASS_LIMITS[state.copperWeight];
  const isCopperBad = state.patternClass > maxClassCopper;
  DOM.cardPatternRes.setAttribute('data-state', isCopperBad ? 'fail' : 'pass');
  
  // 3. Drill Class Compatibility
  const compliesDrill = res.drillClassQualify[state.drillClass] === 'pass';
  DOM.valDrillClass.textContent = `Drill Class ${state.drillClass}`;
  DOM.cardDrillCompat.setAttribute('data-state', compliesDrill ? 'pass' : 'fail');
  DOM.valDrillClass.nextElementSibling.textContent = compliesDrill 
    ? `TOOLSIZE satisfies class ${state.drillClass} limits` 
    : `TOOLSIZE is too small for class ${state.drillClass}`;
    
  // 4. Base Copper weight
  DOM.valPlatingThickness.textContent = `${state.copperWeight} µm`;
  DOM.cardCopperThick.setAttribute('data-state', isCopperBad ? 'fail' : 'pass');
  DOM.valPlatingThickness.nextElementSibling.textContent = isCopperBad 
    ? `Limit is Class ${maxClassCopper} (Change copper/class)` 
    : `Compatible with Pattern Class ${state.patternClass}`;
    
  // 5. Inner Pad Insulation (IPI)
  DOM.valTangencyStatus.textContent = `${targetRule.minIPI.toFixed(3)} mm`;
  DOM.cardTangency.setAttribute('data-state', 'pass');
  
  // 6. Minimum Pad Diameter required
  const activeMinPad = toActiveUnit(res.minPadReq_mm);
  DOM.valMinPadReq.textContent = activeMinPad.toFixed(state.unit === 'mils' ? 2 : 3) + ' ' + state.unit;
  
  const isPadDiameterLow = toMm(state.padDiameter) < res.minPadReq_mm;
  DOM.cardMinPad.setAttribute('data-state', isPadDiameterLow ? 'fail' : 'pass');
}

function renderComplianceTables(res) {
  // Pattern Table: loop 3 to 9
  for (let c = 3; c <= 9; c++) {
    const cell = document.getElementById(`res-pat${c}`);
    if (cell) {
      const q = res.patternClassQualify[c];
      
      // Update cell content
      if (q === 'pass') {
        cell.innerHTML = '<span class="badge badge-pass">✓ Pass</span>';
      } else if (q === 'copper-limit') {
        cell.innerHTML = '<span class="badge badge-warning">⚠️ Cu Limit</span>';
      } else {
        cell.innerHTML = '<span class="badge badge-fail">✗ Fail</span>';
      }
    }
  }
  
  // Drill Table: loop A to E
  for (const key of ['A', 'B', 'C', 'D', 'E']) {
    const cell = document.getElementById(`res-dr${key}`);
    if (cell) {
      const complies = res.drillClassQualify[key] === 'pass';
      if (complies) {
        cell.innerHTML = '<span class="badge badge-pass">✓ Pass</span>';
      } else {
        cell.innerHTML = '<span class="badge badge-fail">✗ Fail</span>';
      }
    }
  }
  
  // Highlight active column headers in tables
  // For pattern table, toggle a class on the cells
  const pHeaders = DOM.euroPatternTable.querySelectorAll('thead th');
  const pRows = DOM.euroPatternTable.querySelectorAll('tbody tr');
  
  // Columns correspond to: Parameter Name (0), Class 3 (1), Class 4 (2)...
  const targetColIndex = state.patternClass - 2; // Class 3 index is 1, etc.
  
  pHeaders.forEach((th, i) => {
    th.classList.toggle('active-class-row', i === targetColIndex);
  });
  pRows.forEach(row => {
    row.querySelectorAll('td').forEach((td, i) => {
      // Offset by 1 because first cell is feature name (which has index 0 in td list but th list has th as index 0)
      td.classList.toggle('active-class-row', i === targetColIndex - 1);
    });
  });
  
  // For drill table, Class A is col 1, etc.
  const dHeaders = DOM.euroDrillTable.querySelectorAll('thead th');
  const dRows = DOM.euroDrillTable.querySelectorAll('tbody tr');
  const drillColIndices = { 'A': 1, 'B': 2, 'C': 3, 'D': 4, 'E': 5 };
  const targetDrillColIndex = drillColIndices[state.drillClass];
  
  dHeaders.forEach((th, i) => {
    th.classList.toggle('active-class-row', i === targetDrillColIndex);
  });
  dRows.forEach(row => {
    row.querySelectorAll('td').forEach((td, i) => {
      td.classList.toggle('active-class-row', i === targetDrillColIndex - 1);
    });
  });
}

function renderRecommendations(res) {
  const recList = DOM.recommendationList;
  recList.innerHTML = '';
  
  let recs = [];
  
  // 1. Component Lead & Clearance checks
  const leadSize_mm = state.leadShape === 'round'
    ? toMm(state.leadDiameter)
    : Math.sqrt(toMm(state.leadWidth) ** 2 + toMm(state.leadThickness) ** 2);
  const finishedHole_mm = toMm(state.finishedHole);
  const clearance_mm = finishedHole_mm - leadSize_mm;
  
  if (clearance_mm <= 0) {
    recs.push({
      text: `Critical conflict! Component lead size (${formatValue(toActiveUnit(leadSize_mm))}) is equal to or larger than the finished hole size (${formatValue(state.finishedHole)}). Assembly is physically impossible. Increase the hole size or decrease the lead size.`,
      type: 'error'
    });
  } else if (clearance_mm < 0.10) {
    recs.push({
      text: `Clearance Warning! The gap between the component lead and the hole is extremely narrow (${formatValue(toActiveUnit(clearance_mm))}). This is below the minimum recommended assembly threshold of 0.10 mm (4 mils). Lead insertion may be obstructed and solder fill could fail.`,
      type: 'warning'
    });
  } else if (state.autoCalcHole) {
    const clearanceTarget = state.ipcLevel === 'A' ? 0.25 : (state.ipcLevel === 'B' ? 0.20 : 0.15);
    recs.push({
      text: `Finished hole size is auto-calculated using IPC-7251 Level ${state.ipcLevel} rules (Lead size + ${clearanceTarget.toFixed(2)} mm clearance).`,
      type: 'pass'
    });
  } else {
    recs.push({
      text: `Auto Hole Size is disabled. Manual override active. Ensure your finished hole size of ${formatValue(state.finishedHole)} accounts for the component lead dimension of ${formatValue(toActiveUnit(leadSize_mm))} plus manufacturing tolerances.`,
      type: 'info'
    });
  }
  
  // 2. General Pattern Class check
  const actualRing = state.layerType === 'external' ? res.designOar_mm : res.designIar_mm;
  const reqRing = res.requiredMin_mm;
  const compliesPattern = actualRing >= reqRing;
  const maxClassCopper = COPPER_CLASS_LIMITS[state.copperWeight];
  const isCopperBad = state.patternClass > maxClassCopper;
  
  if (compliesPattern && !isCopperBad) {
    recs.push({
      text: `Design complies geometrically with Eurocircuits Pattern Class ${state.patternClass} rules for ${state.layerType === 'external' ? 'outer' : 'inner'} layers.`,
      type: 'pass'
    });
  } else if (!compliesPattern) {
    recs.push({
      text: `Pattern Class ${state.patternClass} violation! Increase Pad Diameter to at least ${formatValue(toActiveUnit(res.minPadReq_mm))} to meet the minimum required ring of ${formatValue(toActiveUnit(reqRing))}.`,
      type: 'error'
    });
  }
  
  // 3. Copper Thickness compatibility warning
  if (isCopperBad) {
    recs.push({
      text: `Copper thickness ${state.copperWeight} µm is too thick for Pattern Class ${state.patternClass}. To use Class ${state.patternClass}, reduce base copper to 12 µm or 18 µm, or reduce Pattern Class to Class ${maxClassCopper}.`,
      type: 'error'
    });
  }
  
  // 4. Aspect Ratio warning
  if (res.aspectRatio > 8) {
    recs.push({
      text: `Aspect Ratio (${res.aspectRatio.toFixed(2)}:1) violates Eurocircuits limit of 8:1 for plated holes. The hole may not metalize properly. Increase hole size or select a thinner board.`,
      type: 'error'
    });
  } else if (res.aspectRatio >= 7) {
    recs.push({
      text: `Aspect Ratio (${res.aspectRatio.toFixed(2)}:1) is close to the 8:1 limit. Design rules are tight; confirm with factory.`,
      type: 'warning'
    });
  }
  
  // 5. Drill Class validation
  const compliesDrill = res.drillClassQualify[state.drillClass] === 'pass';
  if (!compliesDrill) {
    // Find the actual qualified class
    let qualifiedDrillClass = 'None';
    for (const key of ['E', 'D', 'C', 'B', 'A']) {
      if (res.drillClassQualify[key] === 'pass') {
        qualifiedDrillClass = key;
        break;
      }
    }
    recs.push({
      text: `TOOLSIZE (${formatValue(toActiveUnit(res.toolsize_mm))}) is below Drill Class ${state.drillClass} minimum. Change Target Drill Class to ${qualifiedDrillClass === 'None' ? 'E (or consult factory)' : qualifiedDrillClass} to match the drill classification.`,
      type: 'error'
    });
  }
  
  // 6. NPTH Pad reminder
  if (state.holeType === 'NPTH') {
    recs.push({
      text: `Non-Plated Through Hole (NPTH) selected: no copper plating is added to the hole barrel. TOOLSIZE is equal to Finished Hole (${formatValue(toActiveUnit(res.toolsize_mm))}).`,
      type: 'info'
    });
  }
  
  // Render to DOM
  recs.forEach(rec => {
    const li = document.createElement('li');
    li.textContent = rec.text;
    if (rec.type === 'warning') li.className = 'rec-warning';
    if (rec.type === 'error') li.className = 'rec-error';
    if (rec.type === 'pass') li.className = 'rec-pass';
    if (rec.type === 'info') li.className = 'rec-info';
    recList.appendChild(li);
  });
}

// --- Interactive SVGs Graphical Rendering ---

function renderSVGTopView(res) {
  const svg = document.getElementById('svg-top-group');
  if (!svg) return;
  svg.innerHTML = '';
  
  const pad_mm = toMm(state.padDiameter);
  const finishedHole_mm = toMm(state.finishedHole);
  const toolsize_mm = res.toolsize_mm;
  
  const cx = 200;
  const cy = 160;
  
  // Scaling factors
  const maxDimension = Math.max(pad_mm, 0.5);
  const scale = 110 / (maxDimension / 2);
  
  const padRadiusPx = (pad_mm / 2) * scale;
  const toolRadiusPx = (toolsize_mm / 2) * scale;
  const holeRadiusPx = (finishedHole_mm / 2) * scale;
  
  const leadSize_mm = state.leadShape === 'round'
    ? toMm(state.leadDiameter)
    : Math.sqrt(toMm(state.leadWidth) ** 2 + toMm(state.leadThickness) ** 2);
    
  const pinRadiusPx = (toMm(state.leadDiameter) / 2) * scale;
  const pinWidthPx = toMm(state.leadWidth) * scale;
  const pinHeightPx = toMm(state.leadThickness) * scale;
  const diagonalPx = Math.sqrt(pinWidthPx ** 2 + pinHeightPx ** 2);
  const leadRadiusPx = state.leadShape === 'round' ? pinRadiusPx : (diagonalPx / 2);
  const gapPx = holeRadiusPx - leadRadiusPx;
  
  const status = (state.layerType === 'external' ? res.designOar_mm : res.designIar_mm) >= res.requiredMin_mm ? 'pass' : 'fail';
  const ringColor = status === 'pass' ? '#10b981' : '#ef4444';
  
  // Renders the OTW trace representation
  const targetRule = EURO_PATTERN_RULES[state.patternClass];
  const traceWidthPx = (targetRule.minOTW / 2) * scale;
  
  let html = `
    <defs>
      <linearGradient id="pin-metal-grad" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stop-color="#ffffff" />
        <stop offset="35%" stop-color="#e5e7eb" />
        <stop offset="65%" stop-color="#9ca3af" />
        <stop offset="100%" stop-color="#374151" />
      </linearGradient>
      <radialGradient id="pad-grad" cx="50%" cy="50%" r="50%">
        <stop offset="0%" stop-color="#E27A3F" />
        <stop offset="85%" stop-color="#CA6228" />
        <stop offset="100%" stop-color="#9C4412" />
      </radialGradient>
    </defs>
    
    <!-- Solder mask relief (slightly larger than pad) -->
    <circle cx="${cx}" cy="${cy}" r="${padRadiusPx + 12}" fill="#10b981" opacity="0.05" />
    
    <!-- Pattern Class Trace entering the Pad -->
    <rect x="${cx - traceWidthPx}" y="${cy}" width="${traceWidthPx * 2}" height="140" fill="url(#pad-grad)" opacity="0.9" />
    <line x1="${cx - traceWidthPx}" y1="${cy}" x2="${cx - traceWidthPx}" y2="${cy + 140}" stroke="#9ca3af" stroke-width="0.5" opacity="0.3" />
    <line x1="${cx + traceWidthPx}" y1="${cy}" x2="${cx + traceWidthPx}" y2="${cy + 140}" stroke="#9ca3af" stroke-width="0.5" opacity="0.3" />
    
    <!-- Copper Pad -->
    <circle cx="${cx}" cy="${cy}" r="${padRadiusPx}" fill="url(#pad-grad)" filter="drop-shadow(0 4px 8px rgba(0,0,0,0.5))" />
    
    <!-- OAR Ring Indicator Outline -->
    <circle cx="${cx}" cy="${cy}" r="${padRadiusPx}" fill="none" stroke="${ringColor}" stroke-width="2" opacity="0.8" />
    
    <!-- TOOLSIZE Drill Hole (represented as dashed red boundary showing drill cutter boundary) -->
    <circle cx="${cx}" cy="${cy}" r="${toolRadiusPx}" fill="none" stroke="#ff3838" stroke-width="3" stroke-dasharray="6 4" opacity="1.0" />
    
    <!-- Finished Hole inside barrel -->
    <circle cx="${cx}" cy="${cy}" r="${holeRadiusPx}" fill="#06090e" stroke="#ca6228" stroke-width="1.5" />
  `;
  
  // Plating copper ring (only for PTH)
  if (state.holeType === 'PTH') {
    html += `
      <!-- Plating inside diameter barrel -->
      <circle cx="${cx}" cy="${cy}" r="${holeRadiusPx}" fill="none" stroke="#e27a3f" stroke-width="3.5" opacity="0.8" />
    `;
  }
  
  // Draw the component lead pin
  if (state.leadShape === 'round') {
    html += `
      <!-- Component Lead (Round Pin) -->
      <circle cx="${cx}" cy="${cy}" r="${pinRadiusPx}" fill="url(#pin-metal-grad)" stroke="#1f2937" stroke-width="1.5" filter="drop-shadow(0 2px 4px rgba(0,0,0,0.4))" />
    `;
  } else {
    html += `
      <!-- Effective lead diagonal boundary (dashed guide) -->
      <circle cx="${cx}" cy="${cy}" r="${diagonalPx / 2}" fill="none" stroke="#3b82f6" stroke-width="1" stroke-dasharray="3 3" opacity="0.5" />
      
      <!-- Component Lead (Rectangular Pin) -->
      <rect x="${cx - pinWidthPx / 2}" y="${cy - pinHeightPx / 2}" width="${pinWidthPx}" height="${pinHeightPx}" rx="1.5" ry="1.5" fill="url(#pin-metal-grad)" stroke="#1f2937" stroke-width="1.5" filter="drop-shadow(0 2px 4px rgba(0,0,0,0.4))" />
    `;
  }
  
  // Dimension and leader line overlays
  
  // 1. Center crosshairs
  html += `
    <line x1="${cx - 10}" y1="${cy}" x2="${cx + 10}" y2="${cy}" stroke="#9ca3af" stroke-width="1" opacity="0.4" />
    <line x1="${cx}" y1="${cy - 10}" x2="${cx}" y2="${cy + 10}" stroke="#9ca3af" stroke-width="1" opacity="0.4" />
  `;
  
  // 2. Pad diameter dimension (gold line and text)
  html += `
    <line x1="${cx - padRadiusPx}" y1="28" x2="${cx + padRadiusPx}" y2="28" stroke="#d4a84b" stroke-width="1.5" />
    <line x1="${cx - padRadiusPx}" y1="22" x2="${cx - padRadiusPx}" y2="34" stroke="#d4a84b" stroke-width="1.5" />
    <line x1="${cx + padRadiusPx}" y1="22" x2="${cx + padRadiusPx}" y2="34" stroke="#d4a84b" stroke-width="1.5" />
    <text x="${cx}" y="18" text-anchor="middle" fill="#d4a84b" font-family="JetBrains Mono" font-size="11" font-weight="600">
      D: ${state.padDiameter.toFixed(state.unit === 'mils' ? 1 : 2)} ${state.unit}
    </text>
  `;
  
  // 3. Finished Hole dimension leader line (pointing to hole edge)
  const fhAngleRad = 135 * Math.PI / 180;
  const leaderStartX = cx + holeRadiusPx * Math.cos(fhAngleRad);
  const leaderStartY = cy + holeRadiusPx * Math.sin(fhAngleRad);
  const leaderEndX = leaderStartX - 20;
  const leaderEndY = leaderStartY + 25;
  
  html += `
    <path d="M ${leaderStartX} ${leaderStartY} L ${leaderEndX} ${leaderEndY} L ${leaderEndX - 15} ${leaderEndY}" fill="none" stroke="#ca6228" stroke-width="1" opacity="0.8" />
    <text x="${leaderEndX - 18}" y="${leaderEndY + 3}" text-anchor="end" fill="#ca6228" font-family="JetBrains Mono" font-size="10" font-weight="600" opacity="0.9">
      ⌀d (hole): ${state.finishedHole.toFixed(state.unit === 'mils' ? 1 : 2)} ${state.unit}
    </text>
  `;
  
  // 4. Pin dimension leader line (pointing to pin edge)
  const pinLabelX = cx + 80;
  const pinLabelY = cy - 80;
  const pinPointX = cx + (state.leadShape === 'round' ? pinRadiusPx * 0.7 : (pinWidthPx / 3));
  const pinPointY = cy - (state.leadShape === 'round' ? pinRadiusPx * 0.7 : (pinHeightPx / 3));
  
  const leadValText = state.leadShape === 'round'
    ? `⌀${state.leadDiameter.toFixed(state.unit === 'mils' ? 1 : 2)}`
    : `${state.leadWidth.toFixed(state.unit === 'mils' ? 1 : 2)}x${state.leadThickness.toFixed(state.unit === 'mils' ? 1 : 2)}`;
    
  html += `
    <path d="M ${pinPointX} ${pinPointY} L ${pinLabelX - 15} ${pinLabelY} L ${pinLabelX} ${pinLabelY}" fill="none" stroke="#9ca3af" stroke-width="1" opacity="0.8" />
    <text x="${pinLabelX + 3}" y="${pinLabelY + 3}" text-anchor="start" fill="#9ca3af" font-family="Inter" font-size="10" font-weight="600" opacity="0.9">
      Pin (${state.leadShape === 'round' ? 'Round' : 'Rect'}): ${leadValText} ${state.unit}
    </text>
  `;
  
  // 5. Clearance Gap Indicator (diagonal blue line at 30 deg showing clearance)
  const angleRad = -30 * Math.PI / 180;
  const cos = Math.cos(angleRad);
  const sin = Math.sin(angleRad);
  
  const startX = cx + leadRadiusPx * cos;
  const startY = cy - leadRadiusPx * sin;
  const endX = cx + holeRadiusPx * cos;
  const endY = cy - holeRadiusPx * sin;
  
  html += `
    <line x1="${startX}" y1="${startY}" x2="${endX}" y2="${endY}" stroke="#3b82f6" stroke-width="2" />
    <circle cx="${startX}" cy="${startY}" r="2" fill="#3b82f6" />
    <circle cx="${endX}" cy="${endY}" r="2" fill="#3b82f6" />
  `;
  
  // 6. Clearance leader line
  const clearanceLabelX = cx + 80;
  const clearanceLabelY = cy - 40;
  const clearanceGapStartX = cx + (leadRadiusPx + gapPx / 2) * cos;
  const clearanceGapStartY = cy - (leadRadiusPx + gapPx / 2) * sin;
  const clearanceValueMm = toMm(state.finishedHole) - leadSize_mm;
  const clearanceText = toActiveUnit(clearanceValueMm).toFixed(state.unit === 'mils' ? 1 : 2) + ' ' + state.unit;
  
  html += `
    <path d="M ${clearanceGapStartX} ${clearanceGapStartY} L ${clearanceLabelX - 15} ${clearanceLabelY} L ${clearanceLabelX} ${clearanceLabelY}" fill="none" stroke="#3b82f6" stroke-width="1" opacity="0.8" />
    <text x="${clearanceLabelX + 3}" y="${clearanceLabelY + 3}" text-anchor="start" fill="#3b82f6" font-family="JetBrains Mono" font-size="10" font-weight="600" opacity="0.9">
      Clearance Gap: ${clearanceText}
    </text>
  `;
  
  // 7. OAR ring dimension line mapping
  html += `
    <line x1="${cx + toolRadiusPx}" y1="${cy}" x2="${cx + padRadiusPx}" y2="${cy}" stroke="${ringColor}" stroke-width="2" />
    <line x1="${cx + toolRadiusPx}" y1="${cy - 4}" x2="${cx + toolRadiusPx}" y2="${cy + 4}" stroke="${ringColor}" stroke-width="1.5" />
    <text x="${cx + toolRadiusPx + (padRadiusPx - toolRadiusPx)/2}" y="${cy - 8}" text-anchor="middle" fill="${ringColor}" font-family="JetBrains Mono" font-size="11" font-weight="700">
      ${toActiveUnit(state.layerType === 'external' ? res.designOar_mm : res.designIar_mm).toFixed(state.unit === 'mils' ? 1 : 3)}
    </text>
  `;
  
  svg.innerHTML = html;
}

function renderSVGCrossSection(res) {
  const svg = document.getElementById('svg-cross-group');
  if (!svg) return;
  svg.innerHTML = '';
  
  const pad_mm = toMm(state.padDiameter);
  const finishedHole_mm = toMm(state.finishedHole);
  const toolsize_mm = res.toolsize_mm;
  const board_mm = toMm(state.boardThickness);
  
  const cx = 200;
  const boardTop = 100;
  const boardHeight = 110;
  
  // Scaling factors
  const scale = 110 / (pad_mm / 2);
  
  const padWidthPx = (pad_mm / 2) * scale;
  const drillWidthPx = (toolsize_mm / 2) * scale;
  const holeWidthPx = (finishedHole_mm / 2) * scale;
  
  const pinWidthPx = (state.leadShape === 'round' ? toMm(state.leadDiameter) : toMm(state.leadWidth)) * scale;
  const pinHalfWidth = pinWidthPx / 2;
  
  // Copper foil height representation
  const copperFoilHeight = Math.max(4, (state.copperWeight / 35) * 8);
  const platingWidth = Math.max(2, drillWidthPx - holeWidthPx);
  
  const status = (state.layerType === 'external' ? res.designOar_mm : res.designIar_mm) >= res.requiredMin_mm ? 'pass' : 'fail';
  const ringColor = status === 'pass' ? '#10b981' : '#ef4444';
  
  let html = `
    <defs>
      <linearGradient id="pin-metal-grad" x1="0%" y1="0%" x2="100%" y2="0%">
        <stop offset="0%" stop-color="#ffffff" />
        <stop offset="30%" stop-color="#e5e7eb" />
        <stop offset="70%" stop-color="#9ca3af" />
        <stop offset="100%" stop-color="#4b5563" />
      </linearGradient>
      <linearGradient id="pad-grad" x1="0%" y1="0%" x2="100%" y2="0%">
        <stop offset="0%" stop-color="#E27A3F" />
        <stop offset="100%" stop-color="#9C4412" />
      </linearGradient>
    </defs>
    
    <!-- Substrate board (FR4 Green Laminate) -->
    <rect x="50" y="${boardTop}" width="300" height="${boardHeight}" fill="#163020" rx="3" stroke="#254d33" stroke-width="1" />
    
    <!-- Top Pad Cladding -->
    <rect x="${cx - padWidthPx}" y="${boardTop - copperFoilHeight}" width="${padWidthPx * 2}" height="${copperFoilHeight}" fill="url(#pad-grad)" />
    
    <!-- Bottom Pad Cladding -->
    <rect x="${cx - padWidthPx}" y="${boardTop + boardHeight}" width="${padWidthPx * 2}" height="${copperFoilHeight}" fill="url(#pad-grad)" />
    
    <!-- Plated Through Hole barrel gap -->
    <rect x="${cx - drillWidthPx}" y="${boardTop - copperFoilHeight - 10}" width="${drillWidthPx * 2}" height="${boardHeight + copperFoilHeight * 2 + 20}" fill="#06090e" />
  `;
  
  if (state.holeType === 'PTH') {
    html += `
      <!-- Barrel Copper Plating (Left & Right Walls) -->
      <rect x="${cx - drillWidthPx}" y="${boardTop - copperFoilHeight}" width="${platingWidth}" height="${boardHeight + copperFoilHeight * 2}" fill="#e27a3f" />
      <rect x="${cx + drillWidthPx - platingWidth}" y="${boardTop - copperFoilHeight}" width="${platingWidth}" height="${boardHeight + copperFoilHeight * 2}" fill="#e27a3f" />
    `;
  }
  
  // Render component pin vertically in the center
  html += `
    <!-- Component Lead Pin -->
    <rect x="${cx - pinHalfWidth}" y="${boardTop - copperFoilHeight - 20}" width="${pinWidthPx}" height="${boardHeight + copperFoilHeight * 2 + 40}" fill="url(#pin-metal-grad)" stroke="#1f2937" stroke-width="1.2" rx="1.5" />
  `;
  
  // Draw left side clearance gap indicator inside barrel
  const barrelWallLeftX = cx - holeWidthPx;
  const pinLeftX = cx - pinHalfWidth;
  const gapY = boardTop + boardHeight / 2;
  
  if (pinLeftX > barrelWallLeftX) {
    html += `
      <!-- Clearance Gap Indicator in Cross-Section -->
      <line x1="${barrelWallLeftX}" y1="${gapY}" x2="${pinLeftX}" y2="${gapY}" stroke="#3b82f6" stroke-width="2" />
      <line x1="${barrelWallLeftX}" y1="${gapY - 4}" x2="${barrelWallLeftX}" y2="${gapY + 4}" stroke="#3b82f6" stroke-width="1.5" />
      <line x1="${pinLeftX}" y1="${gapY - 4}" x2="${pinLeftX}" y2="${gapY + 4}" stroke="#3b82f6" stroke-width="1.5" />
      <text x="${(barrelWallLeftX + pinLeftX) / 2}" y="${gapY - 6}" text-anchor="middle" fill="#3b82f6" font-family="JetBrains Mono" font-size="9" font-weight="600">
        Gap
      </text>
    `;
  }
  
  html += `
    <!-- Dimension lines: Ring indicator -->
    <line x1="${cx - padWidthPx}" y1="${boardTop - copperFoilHeight - 20}" x2="${cx - drillWidthPx}" y2="${boardTop - copperFoilHeight - 20}" stroke="${ringColor}" stroke-width="2" />
    <line x1="${cx - padWidthPx}" y1="${boardTop - copperFoilHeight - 25}" x2="${cx - padWidthPx}" y2="${boardTop - copperFoilHeight - 15}" stroke="${ringColor}" stroke-width="1.5" />
    <line x1="${cx - drillWidthPx}" y1="${boardTop - copperFoilHeight - 25}" x2="${cx - drillWidthPx}" y2="${boardTop - copperFoilHeight - 15}" stroke="${ringColor}" stroke-width="1.5" />
    <text x="${cx - padWidthPx/2 - drillWidthPx/2}" y="${boardTop - copperFoilHeight - 30}" text-anchor="middle" fill="${ringColor}" font-family="JetBrains Mono" font-size="11" font-weight="700">
      ${toActiveUnit(state.layerType === 'external' ? res.designOar_mm : res.designIar_mm).toFixed(state.unit === 'mils' ? 1 : 3)}
    </text>
    
    <!-- Substrate Labels -->
    <text x="65" y="${boardTop + boardHeight/2 + 5}" fill="#2d7e48" font-family="Inter" font-size="11" font-weight="600">FR-4: ${state.boardThickness.toFixed(1)} ${state.unit}</text>
    <text x="330" y="${boardTop - copperFoilHeight - 8}" fill="#9ca3af" font-family="Inter" font-size="10" text-anchor="end">Top Pad</text>
    <text x="330" y="${boardTop + boardHeight + copperFoilHeight + 15}" fill="#9ca3af" font-family="Inter" font-size="10" text-anchor="end">Bottom Pad</text>
  `;
  
  svg.innerHTML = html;
}



// --- App Initialization & Listener Bindings ---

function initializeApp() {
  // 1. Unit toggle
  document.querySelectorAll('input[name="unit-system"]').forEach(input => {
    input.addEventListener('change', (e) => {
      handleUnitChange(e.target.value);
    });
  });
  
  // 2. Class buttons
  document.querySelectorAll('.pattern-class-group .class-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const c = parseInt(btn.getAttribute('data-class'));
      selectPatternClass(c);
    });
  });
  
  document.querySelectorAll('.drill-class-group .class-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const key = btn.getAttribute('data-drill-class');
      selectDrillClass(key);
    });
  });
  
  // 3. Slider dynamic binding
  DOM.padSlider.addEventListener('input', (e) => {
    handlePadSliderInput(e.target.value);
  });
  
  // 4. Geometry & board inputs
  DOM.finishedHole.addEventListener('input', (e) => {
    handleFinishedHoleInput(e.target.value);
    updateCalculations();
  });
  DOM.finishedHole.addEventListener('change', (e) => {
    handleFinishedHoleInput(e.target.value);
    updateCalculations();
  });
  
  DOM.padDiameter.addEventListener('input', (e) => {
    handlePadInput(e.target.value);
    updateCalculations();
  });
  DOM.padDiameter.addEventListener('change', (e) => {
    handlePadInput(e.target.value);
    updateCalculations();
  });
  
  DOM.boardThickness.addEventListener('input', (e) => {
    handleBoardThicknessInput(e.target.value);
    updateCalculations();
  });
  DOM.boardThickness.addEventListener('change', (e) => {
    handleBoardThicknessInput(e.target.value);
    updateCalculations();
  });
  
  DOM.holeType.addEventListener('change', (e) => {
    handleHoleTypeChange(e.target.value);
    updateCalculations();
  });
  
  DOM.copperWeight.addEventListener('change', (e) => {
    handleCopperWeightChange(e.target.value);
    updateCalculations();
  });
  
  DOM.layerType.addEventListener('change', (e) => {
    handleLayerTypeChange(e.target.value);
    updateCalculations();
  });
  
  // 4b. Component Lead inputs
  DOM.leadShape.addEventListener('change', () => {
    updateCalculations();
  });
  DOM.leadDiameter.addEventListener('input', () => {
    updateCalculations();
  });
  DOM.leadWidth.addEventListener('input', () => {
    updateCalculations();
  });
  DOM.leadThickness.addEventListener('input', () => {
    updateCalculations();
  });
  DOM.ipcLevel.addEventListener('change', () => {
    updateCalculations();
  });
  DOM.autoCalcHole.addEventListener('change', () => {
    updateCalculations();
  });
  
  // 5. Views tabs
  DOM.tabBtnTop.addEventListener('click', () => {
    DOM.tabBtnTop.classList.add('active');
    DOM.tabBtnCross.classList.remove('active');
    DOM.containerVizTop.classList.remove('hidden');
    DOM.containerVizCross.classList.add('hidden');
    state.activeView = 'top';
  });
  
  DOM.tabBtnCross.addEventListener('click', () => {
    DOM.tabBtnCross.classList.add('active');
    DOM.tabBtnTop.classList.remove('active');
    DOM.containerVizCross.classList.remove('hidden');
    DOM.containerVizTop.classList.add('hidden');
    state.activeView = 'cross';
  });
  

  
  // Load default setups on startup: Pattern Class 6, Drill Class C
  selectPatternClass(6);
  selectDrillClass('C');
}

// Start application when DOM has loaded
document.addEventListener('DOMContentLoaded', initializeApp);
