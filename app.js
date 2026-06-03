const csvFiles = {
  daily: "data/Bengaluru_AQIBulletins.csv",
  yearly: "outputs/yearly_aqi_summary.csv",
  monthly: "outputs/monthly_aqi_summary.csv",
  pollutants: "outputs/prominent_pollutant_counts.csv",
};

const categories = ["Good", "Satisfactory", "Moderate", "Poor", "Very Poor", "Severe"];
const categoryColors = {
  Good: "#2ca25f",
  Satisfactory: "#99d594",
  Moderate: "#eab308",
  Poor: "#f97316",
  "Very Poor": "#dc2626",
  Severe: "#7f0000",
};

const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const state = {
  year: "All",
  category: "All",
  pollutant: "",
};

const $ = (selector) => document.querySelector(selector);

function parseCsv(text) {
  const rows = [];
  let row = [];
  let value = "";
  let quoted = false;

  for (let i = 0; i < text.length; i += 1) {
    const char = text[i];
    const next = text[i + 1];

    if (char === '"' && quoted && next === '"') {
      value += '"';
      i += 1;
    } else if (char === '"') {
      quoted = !quoted;
    } else if (char === "," && !quoted) {
      row.push(value);
      value = "";
    } else if ((char === "\n" || char === "\r") && !quoted) {
      if (char === "\r" && next === "\n") i += 1;
      row.push(value);
      if (row.some((cell) => cell !== "")) rows.push(row);
      row = [];
      value = "";
    } else {
      value += char;
    }
  }

  if (value || row.length) {
    row.push(value);
    rows.push(row);
  }

  const headers = rows.shift();
  return rows.map((cells) =>
    Object.fromEntries(headers.map((header, index) => [header, cells[index] ?? ""]))
  );
}

async function loadCsv(path) {
  const response = await fetch(path);
  if (!response.ok) throw new Error(`Could not load ${path}`);
  return parseCsv(await response.text());
}

function enrichDaily(rows) {
  return rows
    .map((row) => {
      const date = new Date(`${row.date}T00:00:00`);
      return {
        date,
        dateLabel: row.date,
        year: date.getFullYear(),
        month: date.getMonth() + 1,
        city: row.City,
        stations: Number(row["No. Stations"]) || null,
        category: row["Air Quality"],
        aqi: Number(row["Index Value"]),
        pollutant: row["Prominent Pollutant"] || "Unknown",
      };
    })
    .filter((row) => Number.isFinite(row.aqi));
}

function filteredDaily(data) {
  const pollutantNeedle = state.pollutant.trim().toLowerCase();
  return data.daily.filter((row) => {
    const yearOk = state.year === "All" || row.year === Number(state.year);
    const categoryOk = state.category === "All" || row.category === state.category;
    const pollutantOk = !pollutantNeedle || row.pollutant.toLowerCase().includes(pollutantNeedle);
    return yearOk && categoryOk && pollutantOk;
  });
}

function average(values) {
  if (!values.length) return 0;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function mode(values) {
  const counts = new Map();
  values.forEach((value) => counts.set(value, (counts.get(value) || 0) + 1));
  return [...counts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] || "-";
}

function groupBy(rows, keyFn) {
  return rows.reduce((groups, row) => {
    const key = keyFn(row);
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(row);
    return groups;
  }, new Map());
}

function showTooltip(html, event) {
  const tooltip = $("#tooltip");
  tooltip.innerHTML = html;
  tooltip.style.left = `${event.clientX}px`;
  tooltip.style.top = `${event.clientY}px`;
  tooltip.classList.add("visible");
}

function hideTooltip() {
  $("#tooltip").classList.remove("visible");
}

function svgElement(name, attrs = {}) {
  const node = document.createElementNS("http://www.w3.org/2000/svg", name);
  Object.entries(attrs).forEach(([key, value]) => node.setAttribute(key, value));
  return node;
}

function renderTrend(rows) {
  const host = $("#trendChart");
  host.innerHTML = "";

  const groups = groupBy(rows, (row) => `${row.year}-${String(row.month).padStart(2, "0")}`);
  const points = [...groups.entries()]
    .map(([key, values]) => {
      const [year, month] = key.split("-").map(Number);
      return {
        key,
        label: `${monthNames[month - 1]} ${year}`,
        value: average(values.map((row) => row.aqi)),
      };
    })
    .sort((a, b) => a.key.localeCompare(b.key));

  const width = 780;
  const height = 330;
  const margin = { top: 18, right: 26, bottom: 46, left: 52 };
  const innerWidth = width - margin.left - margin.right;
  const innerHeight = height - margin.top - margin.bottom;
  const maxValue = Math.max(120, ...points.map((point) => point.value));
  const minValue = Math.min(0, ...points.map((point) => point.value));
  const x = (index) => margin.left + (points.length <= 1 ? innerWidth / 2 : (index / (points.length - 1)) * innerWidth);
  const y = (value) => margin.top + innerHeight - ((value - minValue) / (maxValue - minValue || 1)) * innerHeight;

  const svg = svgElement("svg", { viewBox: `0 0 ${width} ${height}`, role: "img", "aria-label": "Monthly AQI trend" });
  [0, 25, 50, 75, 100].forEach((tick) => {
    const value = minValue + ((maxValue - minValue) * tick) / 100;
    const yy = y(value);
    svg.append(svgElement("line", { class: "grid-line", x1: margin.left, x2: width - margin.right, y1: yy, y2: yy }));
    const label = svgElement("text", { x: margin.left - 10, y: yy + 4, "text-anchor": "end", fill: "#5d6b7a", "font-size": "11" });
    label.textContent = Math.round(value);
    svg.append(label);
  });

  if (points.length) {
    const path = points.map((point, index) => `${index === 0 ? "M" : "L"} ${x(index)} ${y(point.value)}`).join(" ");
    svg.append(svgElement("path", { class: "trend-line", d: path }));
  }

  points.forEach((point, index) => {
    const circle = svgElement("circle", {
      class: "trend-point",
      cx: x(index),
      cy: y(point.value),
      r: 5,
      fill: "#2563eb",
      tabindex: 0,
    });
    const content = `<strong>${point.label}</strong><br/>Average AQI: ${point.value.toFixed(1)}`;
    circle.addEventListener("mousemove", (event) => showTooltip(content, event));
    circle.addEventListener("mouseleave", hideTooltip);
    circle.addEventListener("focus", () => {
      $("#trendHint").textContent = `${point.label}: ${point.value.toFixed(1)}`;
    });
    svg.append(circle);
  });

  const firstYear = points[0]?.label.split(" ")[1] || "";
  const lastYear = points.at(-1)?.label.split(" ")[1] || "";
  [firstYear, lastYear].filter(Boolean).forEach((label, index) => {
    const text = svgElement("text", {
      x: index === 0 ? margin.left : width - margin.right,
      y: height - 14,
      "text-anchor": index === 0 ? "start" : "end",
      fill: "#5d6b7a",
      "font-size": "12",
    });
    text.textContent = label;
    svg.append(text);
  });

  host.append(svg);
}

function renderCategoryChart(rows) {
  const host = $("#categoryChart");
  host.innerHTML = "";

  const counts = categories
    .map((category) => ({ category, days: rows.filter((row) => row.category === category).length }))
    .filter((row) => row.days > 0);
  const maxDays = Math.max(1, ...counts.map((row) => row.days));
  const width = 430;
  const height = 330;
  const margin = { top: 12, right: 18, bottom: 44, left: 42 };
  const innerWidth = width - margin.left - margin.right;
  const innerHeight = height - margin.top - margin.bottom;
  const barWidth = Math.max(28, innerWidth / Math.max(1, counts.length) - 16);
  const svg = svgElement("svg", { viewBox: `0 0 ${width} ${height}`, role: "img", "aria-label": "AQI category distribution" });

  counts.forEach((item, index) => {
    const x = margin.left + index * (innerWidth / counts.length) + 8;
    const barHeight = (item.days / maxDays) * innerHeight;
    const y = margin.top + innerHeight - barHeight;
    const rect = svgElement("rect", {
      class: "bar",
      x,
      y,
      width: barWidth,
      height: barHeight,
      rx: 5,
      fill: categoryColors[item.category] || "#64748b",
      tabindex: 0,
    });
    const content = `<strong>${item.category}</strong><br/>${item.days.toLocaleString()} days`;
    rect.addEventListener("mousemove", (event) => showTooltip(content, event));
    rect.addEventListener("mouseleave", hideTooltip);
    svg.append(rect);

    const label = svgElement("text", { x: x + barWidth / 2, y: height - 18, "text-anchor": "middle", fill: "#5d6b7a", "font-size": "11" });
    label.textContent = item.category;
    svg.append(label);

    const value = svgElement("text", { x: x + barWidth / 2, y: y - 8, "text-anchor": "middle", fill: "#15202b", "font-size": "12", "font-weight": "700" });
    value.textContent = item.days;
    svg.append(value);
  });

  host.append(svg);
}

function renderPollutantChart(rows) {
  const host = $("#pollutantChart");
  host.innerHTML = "";

  const pollutantNeedle = state.pollutant.trim().toLowerCase();
  const counts = new Map();
  rows.forEach((row) => counts.set(row.pollutant, (counts.get(row.pollutant) || 0) + 1));
  const data = [...counts.entries()]
    .map(([pollutant, days]) => ({ pollutant, days }))
    .filter((row) => !pollutantNeedle || row.pollutant.toLowerCase().includes(pollutantNeedle))
    .sort((a, b) => b.days - a.days)
    .slice(0, 10);

  const width = 980;
  const height = 360;
  const margin = { top: 12, right: 40, bottom: 26, left: 180 };
  const innerWidth = width - margin.left - margin.right;
  const rowHeight = 30;
  const maxDays = Math.max(1, ...data.map((row) => row.days));
  const svg = svgElement("svg", { viewBox: `0 0 ${width} ${height}`, role: "img", "aria-label": "Prominent pollutant ranking" });

  data.forEach((item, index) => {
    const y = margin.top + index * rowHeight + 4;
    const widthValue = (item.days / maxDays) * innerWidth;
    const label = svgElement("text", { x: margin.left - 10, y: y + 18, "text-anchor": "end", fill: "#334155", "font-size": "12" });
    label.textContent = item.pollutant.length > 24 ? `${item.pollutant.slice(0, 24)}...` : item.pollutant;
    svg.append(label);

    const rect = svgElement("rect", {
      class: "bar",
      x: margin.left,
      y,
      width: widthValue,
      height: 22,
      rx: 5,
      fill: "#0891b2",
      tabindex: 0,
    });
    rect.addEventListener("mousemove", (event) => showTooltip(`<strong>${item.pollutant}</strong><br/>${item.days.toLocaleString()} days`, event));
    rect.addEventListener("mouseleave", hideTooltip);
    svg.append(rect);

    const value = svgElement("text", { x: margin.left + widthValue + 8, y: y + 17, fill: "#15202b", "font-size": "12", "font-weight": "700" });
    value.textContent = item.days;
    svg.append(value);
  });

  host.append(svg);
}

function heatColor(value, min, max) {
  const t = (value - min) / (max - min || 1);
  const hue = 145 - t * 120;
  const light = 84 - t * 27;
  return `hsl(${hue}, 78%, ${light}%)`;
}

function renderHeatmap(rows) {
  const host = $("#heatmap");
  host.innerHTML = "";

  const groups = groupBy(rows, (row) => `${row.year}-${row.month}`);
  const years = [...new Set(rows.map((row) => row.year))].sort((a, b) => a - b);
  const values = [...groups.values()].map((items) => average(items.map((item) => item.aqi)));
  const min = Math.min(...values, 0);
  const max = Math.max(...values, 100);

  host.append(cell("Year", "heat-label"));
  monthNames.forEach((month) => host.append(cell(month, "heat-label")));

  years.forEach((year) => {
    host.append(cell(year, "heat-label"));
    for (let month = 1; month <= 12; month += 1) {
      const items = groups.get(`${year}-${month}`) || [];
      const value = items.length ? average(items.map((item) => item.aqi)) : null;
      const node = cell(value ? Math.round(value) : "-", "heat-cell");
      if (value) {
        node.style.background = heatColor(value, min, max);
        node.tabIndex = 0;
        const content = `<strong>${monthNames[month - 1]} ${year}</strong><br/>Average AQI: ${value.toFixed(1)}<br/>Records: ${items.length}`;
        node.addEventListener("mousemove", (event) => showTooltip(content, event));
        node.addEventListener("mouseleave", hideTooltip);
        node.addEventListener("focus", () => {
          $("#heatmapHint").textContent = `${monthNames[month - 1]} ${year}: ${value.toFixed(1)}`;
        });
      } else {
        node.style.background = "#edf2f7";
        node.style.color = "#94a3b8";
      }
      host.append(node);
    }
  });
}

function cell(text, className) {
  const node = document.createElement("div");
  node.className = className;
  node.textContent = text;
  return node;
}

function renderTables(rows) {
  const byYear = [...groupBy(rows, (row) => row.year).entries()]
    .map(([year, items]) => ({
      year,
      average: average(items.map((row) => row.aqi)),
      median: median(items.map((row) => row.aqi)),
      max: Math.max(...items.map((row) => row.aqi)),
      poor: items.filter((row) => row.category === "Poor").length,
      records: items.length,
    }))
    .sort((a, b) => a.year - b.year);

  $("#yearlyTable").innerHTML = byYear
    .map(
      (row) => `<tr>
        <td>${row.year}</td>
        <td>${row.average.toFixed(2)}</td>
        <td>${row.median.toFixed(1)}</td>
        <td>${row.max}</td>
        <td>${row.poor}</td>
        <td>${row.records}</td>
      </tr>`
    )
    .join("");

  const latest = [...rows].sort((a, b) => b.date - a.date).slice(0, 120);
  $("#recordsTable").innerHTML = latest
    .map(
      (row) => `<tr>
        <td>${row.dateLabel}</td>
        <td>${row.category}</td>
        <td>${row.aqi}</td>
        <td>${row.pollutant}</td>
      </tr>`
    )
    .join("");
  $("#recordCount").textContent = `${rows.length.toLocaleString()} rows`;
}

function median(values) {
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  if (!sorted.length) return 0;
  return sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2;
}

function updateKpis(rows) {
  const aqiValues = rows.map((row) => row.aqi);
  const years = rows.map((row) => row.year);
  const avg = average(aqiValues);

  $("#recordsKpi").textContent = rows.length.toLocaleString();
  $("#averageKpi").textContent = avg.toFixed(2);
  $("#maxKpi").textContent = rows.length ? Math.max(...aqiValues) : "0";
  $("#categoryKpi").textContent = mode(rows.map((row) => row.category));
  $("#heroAverage").textContent = avg.toFixed(2);
  $("#rangeLabel").textContent = rows.length ? `${Math.min(...years)}-${Math.max(...years)}` : "No matches";
}

function render(data) {
  const rows = filteredDaily(data);
  updateKpis(rows);
  renderTrend(rows);
  renderCategoryChart(rows);
  renderHeatmap(rows);
  renderPollutantChart(rows);
  renderTables(rows);
}

function setupControls(data) {
  const years = ["All", ...new Set(data.daily.map((row) => row.year))].sort((a, b) => {
    if (a === "All") return -1;
    if (b === "All") return 1;
    return a - b;
  });
  $("#yearFilter").innerHTML = years.map((year) => `<option value="${year}">${year}</option>`).join("");
  $("#categoryFilter").innerHTML = ["All", ...categories.filter((category) => data.daily.some((row) => row.category === category))]
    .map((category) => `<option value="${category}">${category}</option>`)
    .join("");

  $("#yearFilter").addEventListener("change", (event) => {
    state.year = event.target.value;
    render(data);
  });
  $("#categoryFilter").addEventListener("change", (event) => {
    state.category = event.target.value;
    render(data);
  });
  $("#pollutantSearch").addEventListener("input", (event) => {
    state.pollutant = event.target.value;
    render(data);
  });
  $("#resetFilters").addEventListener("click", () => {
    state.year = "All";
    state.category = "All";
    state.pollutant = "";
    $("#yearFilter").value = "All";
    $("#categoryFilter").value = "All";
    $("#pollutantSearch").value = "";
    render(data);
  });
}

function setupTabs() {
  document.querySelectorAll(".tab").forEach((tab) => {
    tab.addEventListener("click", () => {
      document.querySelectorAll(".tab").forEach((item) => item.classList.remove("active"));
      document.querySelectorAll(".view").forEach((item) => item.classList.remove("active"));
      tab.classList.add("active");
      $(`#${tab.dataset.view}`).classList.add("active");
    });
  });
}

async function main() {
  try {
    const [daily, yearly, monthly, pollutants] = await Promise.all([
      loadCsv(csvFiles.daily),
      loadCsv(csvFiles.yearly),
      loadCsv(csvFiles.monthly),
      loadCsv(csvFiles.pollutants),
    ]);
    const data = {
      daily: enrichDaily(daily),
      yearly,
      monthly,
      pollutants,
    };
    setupControls(data);
    setupTabs();
    render(data);
  } catch (error) {
    document.body.innerHTML = `<main class="app-shell"><section class="panel"><h1>Could not load dashboard data</h1><p>${error.message}</p><p>Run this page from a local server so the browser can fetch CSV files.</p></section></main>`;
  }
}

main();
