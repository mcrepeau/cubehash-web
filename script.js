// Utility functions
const toHex = (bytes) => Array.from(bytes, b => b.toString(16).padStart(2, "0")).join("");
const bytesToMB = (n) => n / 1_000_000;

// State variables
let lastFileDigest = null;
let lastStringDigest = null;

// Hashing functions
async function hashFileStreamed(file, revision, hashLenBits, onProgress) {
  const hasher = new WasmCubeHash(revision, hashLenBits);
  const reader = file.stream().getReader();
  const total = file.size;
  let processed = 0;

  const t0 = performance.now();
  try {
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      hasher.update(value);
      processed += value.length;
      if (onProgress) onProgress(processed / total);
    }
  } finally {
    reader.releaseLock();
  }
  const digest = hasher.finalize();
  const t1 = performance.now();

  return { digest, elapsedMs: t1 - t0 };
}

async function hashString(str, revision, bits) {
  const enc = new TextEncoder().encode(str);
  const hasher = new WasmCubeHash(revision, bits);
  hasher.update(enc);
  return hasher.finalize();
}

// Main function
function main() {
  const $ = (id) => document.getElementById(id);

  const fileEl = $("file");
  const fileInfoEl = $("fileInfo");
  const outEl = $("out");
  const timeEl = $("timeMs");
  const mbpsEl = $("mbps");
  const btnFile = $("hashFileBtn");
  const errEl = $("err");
  const copyBtn = $("copyBtn");
  const copyMsg = $("copyMsg");
  const strEl = $("inputStr");
  const revEl = $("revision");
  const bitsEl = $("bits");

  const fileTabBtn = $("fileTab");
  const strTabBtn = $("stringTab");
  const fileTab = $("fileTabContent");
  const strTab = $("stringTabContent");
  const perfEl = $("perfInfo");

  // Progress bar elements
  const progressFill = btnFile.querySelector('.progress-fill');
  const btnText = btnFile.querySelector('.btn-text');

  function showDigest(digest, elapsedMs, fileSize) {
	outEl.textContent = toHex(digest);
	timeEl.value = elapsedMs ? `${elapsedMs.toFixed(2)} ms` : "–";
	if (fileSize !== undefined) {
	  const mb = bytesToMB(fileSize);
	  const seconds = elapsedMs / 1000;
	  const mbps = seconds > 0 ? (mb / seconds) : 0;
	  mbpsEl.value = `${mbps.toFixed(2)} MB/s`;
	} else {
	  mbpsEl.value = "–";
	}
  }

  function updateProgress(progress) {
    const percentage = Math.round(progress * 100);
    progressFill.style.width = `${percentage}%`;
    btnText.textContent = `Hashing... ${percentage}%`;
  }

  function resetProgress() {
    progressFill.style.width = '0%';
    btnText.textContent = 'Hash File';
  }

  function setActiveTab(tab) {
	if (tab === "file") {
	  fileTab.hidden = false;
	  strTab.hidden = true;
	  perfEl.hidden = false;
	  fileTabBtn.classList.add("tab-active");
	  strTabBtn.classList.remove("tab-active");
	  if (lastFileDigest) showDigest(lastFileDigest.digest, lastFileDigest.elapsedMs, lastFileDigest.fileSize);
	  else { outEl.textContent = ""; timeEl.value = "–"; mbpsEl.value = "–"; }
	} else {
	  fileTab.hidden = true;
	  strTab.hidden = false;
	  perfEl.hidden = true;
	  strTabBtn.classList.add("tab-active");
	  fileTabBtn.classList.remove("tab-active");
	  if (lastStringDigest) showDigest(lastStringDigest.digest, lastStringDigest.elapsedMs);
	  else {
		// Always reflect the current (possibly empty) textarea
		updateStringHash();
	  }
	}
  }

  fileTabBtn.addEventListener("click", () => setActiveTab("file"));
  strTabBtn.addEventListener("click", () => setActiveTab("string"));

  function updateFileBtnState() {
	const hasFile = !!fileEl.files?.length;
	btnFile.disabled = !hasFile;
  }
  updateFileBtnState();

  fileEl.addEventListener("change", () => {
	const f = fileEl.files?.[0];
	fileInfoEl.textContent = f ? `${f.name} (${(f.size/1024).toFixed(1)} KB)` : "";
	updateFileBtnState();
	resetProgress(); // Reset progress when new file is selected
  });

  btnFile.addEventListener("click", async () => {
	errEl.textContent = "";
	outEl.textContent = "";
	timeEl.value = "–";
	mbpsEl.value = "–";

	const f = fileEl.files?.[0];
	if (!f) { errEl.textContent = "Pick a file first."; return; }

	// Set up progress bar and disable button
	btnFile.setAttribute("aria-busy", "true");
	btnFile.disabled = true;
	btnFile.classList.add("hashing");
	resetProgress();

	try {
	  const { digest, elapsedMs } = await hashFileStreamed(
		f, Number(revEl.value), Number(bitsEl.value), updateProgress
	  );
	  lastFileDigest = { digest, elapsedMs, fileSize: f.size };
	  showDigest(digest, elapsedMs, f.size);
	} catch (e) {
	  errEl.textContent = `Error: ${e}`;
	} finally {
	  btnFile.removeAttribute("aria-busy");
	  btnFile.disabled = false;
	  btnFile.classList.remove("hashing");
	  resetProgress();
	}
  });

  async function updateStringHash() {
	errEl.textContent = "";
	try {
	  const digest = await hashString(strEl.value, Number(revEl.value), Number(bitsEl.value));
	  lastStringDigest = { digest, elapsedMs: 0 };
	  showDigest(digest, 0);
	} catch (e) {
	  errEl.textContent = `Error: ${e}`;
	}
  }

  strEl.addEventListener("input", updateStringHash);
  revEl.addEventListener("change", () => {
	// Recompute whichever tab is visible
	if (!strTab.hidden) updateStringHash();
	else if (lastFileDigest) setActiveTab("file");
  });
  bitsEl.addEventListener("change", () => {
	if (!strTab.hidden) updateStringHash();
	else if (lastFileDigest) setActiveTab("file");
  });

  copyBtn.addEventListener("click", async () => {
	if (!outEl.textContent) return;
	try {
	  await navigator.clipboard.writeText(outEl.textContent);
	  copyMsg.classList.add("show");
	  setTimeout(() => copyMsg.classList.remove("show"), 1200);
	} catch { /* ignore */ }
  });

  // Default tab + ensure empty string hash works immediately when switching to String
  setActiveTab("file");
}