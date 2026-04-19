// Live date and time updater
function updateLiveDateTime() {
  const dtElem = document.getElementById("live-datetime");
  if (!dtElem) return;
  const now = new Date();
  const options = { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit', second: '2-digit' };
  dtElem.textContent = now.toLocaleString('en-US', options);
}

setInterval(updateLiveDateTime, 1000);
updateLiveDateTime();
const uploadInput = document.querySelector("#csv-upload");
const searchInput = document.querySelector("#search-input");
const statusFilter = document.querySelector("#status-filter");
const fleetFilter = document.querySelector("#fleet-filter");
const rankFilter = document.querySelector("#rank-filter");
const sortFilter = document.querySelector("#sort-filter");
const clearFiltersButton = document.querySelector("#clear-filters");
const addProfileButton = document.querySelector("#add-profile");
const exportCsvButton = document.querySelector("#export-csv");
const summaryRow = document.querySelector("#summary-row");
const profileList = document.querySelector("#profile-list");
const profileDetails = document.querySelector("#profile-details");
const visibleCount = document.querySelector("#visible-count");

const STORAGE_KEY = "pilotProfileDashboard.profiles";
const SELECTED_KEY = "pilotProfileDashboard.selectedStaffNo";
const ACTIVE_RESET_KEY = "pilotProfileDashboard.activeResetApplied";

let profiles = [];
let selectedStaffNo = "";
let isAddingProfile = false;
let pendingImport = null;

const FLEET_OPTIONS = ["ATR72-500", "B737-800"];
const RANK_OPTIONS = ["Captain", "First Officer", "Second Officer"];
const EXPORT_HEADERS = ["StaffNo", "Name", "Rank", "Fleet", "Status", "Address", "Email", "Nationality", "Remarks"];
const SUMMARY_COUNTERS = [
  { id: "total-count", count: () => profiles.length },
  { id: "inactive-count", count: () => profiles.filter((profile) => !profile.active).length },
  { id: "b737-active-captain-count", count: () => countProfiles({ active: true, fleet: isB737, rank: isCaptainRank }) },
  { id: "b737-active-copilot-count", count: () => countProfiles({ active: true, fleet: isB737, rank: isCopilotRank }) },
  { id: "atr72-active-captain-count", count: () => countProfiles({ active: true, fleet: isAtr72, rank: isCaptainRank }) },
  { id: "atr72-active-copilot-count", count: () => countProfiles({ active: true, fleet: isAtr72, rank: isCopilotRank }) },
  { id: "b737-inactive-captain-count", count: () => countProfiles({ active: false, fleet: isB737, rank: isCaptainRank }) },
  { id: "b737-inactive-copilot-count", count: () => countProfiles({ active: false, fleet: isB737, rank: isCopilotRank }) },
  { id: "atr72-inactive-captain-count", count: () => countProfiles({ active: false, fleet: isAtr72, rank: isCaptainRank }) },
  { id: "atr72-inactive-copilot-count", count: () => countProfiles({ active: false, fleet: isAtr72, rank: isCopilotRank }) },
].map((counter) => ({ ...counter, element: document.querySelector(`#${counter.id}`) }));

uploadInput.addEventListener("change", handleUpload);
searchInput.addEventListener("input", render);
statusFilter.addEventListener("change", render);
fleetFilter.addEventListener("change", render);
rankFilter.addEventListener("change", render);
sortFilter.addEventListener("change", render);
clearFiltersButton.addEventListener("click", clearFilters);
addProfileButton.addEventListener("click", startNewProfile);
exportCsvButton.addEventListener("click", exportProfilesCsv);
summaryRow.addEventListener("click", handleSummaryClick);
summaryRow.addEventListener("keydown", handleSummaryKeydown);
profileDetails.addEventListener("click", handleDetailsClick);
profileDetails.addEventListener("submit", handleProfileSave);

restoreSavedProfiles();

function handleUpload(event) {
  const [file] = event.target.files;

  if (!file) {
    return;
  }

  const reader = new FileReader();
  reader.onload = () => {
    try {
      pendingImport = buildImportPreview(parseCsv(String(reader.result)), file.name);
      renderImportPreview();
    } catch (error) {
      pendingImport = null;
      profileDetails.className = "details-empty";
      profileDetails.textContent = error.message;
    }
  };
  reader.readAsText(file);
  event.target.value = "";
}

function parseCsv(text) {
  const rows = [];
  let row = [];
  let field = "";
  let insideQuotes = false;

  for (let i = 0; i < text.length; i += 1) {
    const char = text[i];
    const next = text[i + 1];

    if (char === '"' && insideQuotes && next === '"') {
      field += '"';
      i += 1;
    } else if (char === '"') {
      insideQuotes = !insideQuotes;
    } else if (char === "," && !insideQuotes) {
      row.push(field);
      field = "";
    } else if ((char === "\n" || char === "\r") && !insideQuotes) {
      if (char === "\r" && next === "\n") {
        i += 1;
      }
      row.push(field);
      if (row.some((cell) => cell.trim() !== "")) {
        rows.push(row);
      }
      row = [];
      field = "";
    } else {
      field += char;
    }
  }

  row.push(field);
  if (row.some((cell) => cell.trim() !== "")) {
    rows.push(row);
  }

  const headerIndex = rows.findIndex((csvRow) => csvRow.includes("StaffNo"));
  if (headerIndex === -1) {
    throw new Error("Could not find the StaffNo header in the CSV.");
  }

  const headers = rows[headerIndex].map(clean);
  return rows.slice(headerIndex + 1).map((csvRow) =>
    headers.reduce((record, header, index) => {
      record[header] = clean(csvRow[index] || "");
      return record;
    }, {})
  );
}

function normaliseRows(rows) {
  return rows
    .filter((row) => row.StaffNo || row.FirstName || row.LastName)
    .filter((row) => !String(row.Rank || "").toLowerCase().includes("cabin crew"))
    .map((row) => {
      const fullName = [row.FirstName, row.LastName].filter(Boolean).join(" ").trim() || "Unnamed Pilot";
      const address = [row.Address1, row.Address2, row.City, row.State, row.Postcode].filter(Boolean).join(", ");
      const inactiveRemarks = [row.InactiveReason, row.InactiveRemarks].filter(Boolean).join(" - ");

      return {
        staffNo: row.StaffNo || row.Title || "Not available",
        name: fullName,
        address: address || "No address recorded",
        remarks: inactiveRemarks || "Active pilot profile",
        rank: row.Rank || "Rank not recorded",
        fleet: row.Fleet || "Fleet not recorded",
        nationality: row.Nationality || "Nationality not recorded",
        email: row.email || "Email not recorded",
        active: true,
      };
    });
}

function buildImportPreview(rows, fileName) {
  const identifiableRows = rows.filter((row) => row.StaffNo || row.FirstName || row.LastName);
  const cabinCrewRows = identifiableRows.filter((row) => String(row.Rank || "").toLowerCase().includes("cabin crew"));
  const pilotRows = identifiableRows.filter((row) => !String(row.Rank || "").toLowerCase().includes("cabin crew"));
  const inactiveRows = pilotRows.filter((row) => row.InactiveReason || row.InactiveRemarks);
  const missingFleetRows = pilotRows.filter((row) => !row.Fleet);
  const missingRankRows = pilotRows.filter((row) => !row.Rank);
  const duplicateStaffNumbers = findDuplicateStaffNumbers(pilotRows);

  return {
    fileName,
    profiles: normaliseRows(rows),
    stats: {
      totalRows: rows.length,
      identifiableRows: identifiableRows.length,
      pilotRows: pilotRows.length,
      cabinCrewRows: cabinCrewRows.length,
      skippedRows: rows.length - identifiableRows.length,
      inactiveRows: inactiveRows.length,
      missingFleetRows: missingFleetRows.length,
      missingRankRows: missingRankRows.length,
      duplicateStaffNumbers: duplicateStaffNumbers.length,
    },
    duplicateStaffNumbers,
  };
}

function findDuplicateStaffNumbers(rows) {
  const seen = new Set();
  const duplicates = new Set();

  rows.forEach((row) => {
    const staffNo = clean(row.StaffNo);
    if (!staffNo) {
      return;
    }

    if (seen.has(staffNo)) {
      duplicates.add(staffNo);
    }
    seen.add(staffNo);
  });

  return Array.from(duplicates);
}

function render() {
  pendingImport = null;
  isAddingProfile = false;
  updateCounters();

  const filtered = getFilteredProfiles();
  visibleCount.textContent = `${filtered.length} shown`;
  profileList.innerHTML = "";

  filtered.forEach((profile) => {
    const card = document.createElement("button");
    card.className = "profile-card";
    card.type = "button";
    card.setAttribute("aria-selected", String(profile.staffNo === selectedStaffNo));
    card.addEventListener("click", () => {
      selectedStaffNo = profile.staffNo;
      render();
    });

    card.innerHTML = `
      <span class="avatar">${initials(profile.name)}</span>
      <span>
        <h3>${escapeHtml(profile.name)}</h3>
        <p class="profile-meta">${escapeHtml(profile.staffNo)} | ${escapeHtml(profile.rank)} | ${escapeHtml(profile.fleet)}</p>
        <p class="profile-address">${escapeHtml(profile.address)}</p>
      </span>
      <span class="badge ${profile.active ? "" : "inactive"}">${profile.active ? "Active" : "Inactive"}</span>
    `;

    profileList.appendChild(card);
  });

  const selected = filtered.find((profile) => profile.staffNo === selectedStaffNo) || filtered[0];
  renderDetails(selected);
}

function renderImportPreview() {
  if (!pendingImport) {
    return;
  }

  const { stats } = pendingImport;
  const previewProfiles = pendingImport.profiles.slice(0, 5);
  profileDetails.className = "detail-card import-preview";
  profileDetails.innerHTML = `
    <div>
      <p class="eyebrow">CSV Preview</p>
      <h3>${escapeHtml(pendingImport.fileName)}</h3>
      <p class="profile-meta">Review the import before replacing the current dashboard data.</p>
    </div>

    <div class="import-stats">
      ${importStat("Rows read", stats.totalRows)}
      ${importStat("Pilot profiles", stats.pilotRows)}
      ${importStat("Cabin crew removed", stats.cabinCrewRows)}
      ${importStat("Blank rows skipped", stats.skippedRows)}
      ${importStat("Inactive records found", stats.inactiveRows)}
      ${importStat("Missing fleet", stats.missingFleetRows)}
      ${importStat("Missing rank", stats.missingRankRows)}
      ${importStat("Duplicate staff no.", stats.duplicateStaffNumbers)}
    </div>

    ${renderDuplicateNotice(pendingImport.duplicateStaffNumbers)}

    <div>
      <h3>Sample profiles</h3>
      <div class="import-sample-list">
        ${previewProfiles.map(renderImportSample).join("") || '<p class="profile-meta">No pilot profiles found in this file.</p>'}
      </div>
    </div>

    <div class="form-actions">
      <button class="save-button" type="button" data-action="apply-import">Apply import</button>
      <button class="cancel-button" type="button" data-action="cancel-import">Cancel</button>
    </div>
  `;
}

function importStat(label, value) {
  return `
    <article>
      <span>${escapeHtml(value)}</span>
      <p>${escapeHtml(label)}</p>
    </article>
  `;
}

function renderDuplicateNotice(duplicateStaffNumbers) {
  if (!duplicateStaffNumbers.length) {
    return "";
  }

  return `
    <p class="notice">
      Duplicate staff numbers found: ${escapeHtml(duplicateStaffNumbers.slice(0, 8).join(", "))}
      ${duplicateStaffNumbers.length > 8 ? "..." : ""}
    </p>
  `;
}

function renderImportSample(profile) {
  return `
    <article>
      <span class="avatar">${initials(profile.name)}</span>
      <span>
        <h3>${escapeHtml(profile.name)}</h3>
        <p class="profile-meta">${escapeHtml(profile.staffNo)} | ${escapeHtml(profile.rank)} | ${escapeHtml(profile.fleet)}</p>
      </span>
    </article>
  `;
}

function getFilteredProfiles() {
  const query = searchInput.value.trim().toLowerCase();
  const status = statusFilter.value;
  const fleet = fleetFilter.value;
  const rank = rankFilter.value;
  const sortBy = sortFilter.value;

  return profiles
    .filter((profile) => {
      const matchesStatus =
        status === "all" || (status === "active" && profile.active) || (status === "inactive" && !profile.active);
      const matchesFleet =
        fleet === "all" || (fleet === "b737" && isB737(profile.fleet)) || (fleet === "atr72" && isAtr72(profile.fleet));
      const matchesRank = rank === "all" || matchesRankFilter(profile.rank, rank);
      const searchable = [profile.name, profile.staffNo, profile.rank, profile.fleet, profile.address, profile.remarks]
        .join(" ")
        .toLowerCase();
      return matchesStatus && matchesFleet && matchesRank && (!query || searchable.includes(query));
    })
    .sort((firstProfile, secondProfile) => compareProfiles(firstProfile, secondProfile, sortBy));
}

function updateCounters() {
  SUMMARY_COUNTERS.forEach((counter) => {
    if (counter.element) {
      counter.element.textContent = counter.count();
    }
  });
}

function countProfiles({ active, fleet, rank }) {
  return profiles.filter((profile) => profile.active === active && fleet(profile.fleet) && rank(profile.rank)).length;
}

function isB737(fleet) {
  const normalisedFleet = String(fleet).toLowerCase();
  return !normalisedFleet.includes(",") && normalisedFleet.includes("737");
}

function isAtr72(fleet) {
  const normalisedFleet = String(fleet).toLowerCase();
  return !normalisedFleet.includes(",") && normalisedFleet.includes("atr72");
}

function isCaptainRank(rank) {
  return String(rank).toLowerCase().includes("captain");
}

function isCopilotRank(rank) {
  const normalisedRank = String(rank).toLowerCase().replaceAll("-", " ");
  return (
    normalisedRank.includes("first officer") ||
    normalisedRank.includes("second officer") ||
    normalisedRank.includes("co pilot") ||
    normalisedRank.includes("copilot")
  );
}

function matchesRankFilter(rank, filter) {
  const normalisedRank = String(rank).toLowerCase().replaceAll("-", " ");

  if (filter === "captain") {
    return isCaptainRank(rank);
  }

  if (filter === "copilot") {
    return isCopilotRank(rank);
  }

  if (filter === "first-officer") {
    return normalisedRank.includes("first officer");
  }

  if (filter === "second-officer") {
    return normalisedRank.includes("second officer");
  }

  return true;
}

function compareProfiles(firstProfile, secondProfile, sortBy) {
  return String(firstProfile[sortBy] || "").localeCompare(String(secondProfile[sortBy] || ""), undefined, {
    numeric: true,
    sensitivity: "base",
  });
}

function clearFilters() {
  searchInput.value = "";
  statusFilter.value = "all";
  fleetFilter.value = "all";
  rankFilter.value = "all";
  sortFilter.value = "name";
  render();
}

function handleSummaryClick(event) {
  const summaryCard = event.target.closest("[data-status]");
  if (!summaryCard) {
    return;
  }

  applySummaryFilter(summaryCard);
}

function handleSummaryKeydown(event) {
  if (event.key !== "Enter" && event.key !== " ") {
    return;
  }

  const summaryCard = event.target.closest("[data-status]");
  if (!summaryCard) {
    return;
  }

  event.preventDefault();
  applySummaryFilter(summaryCard);
}

function applySummaryFilter(summaryCard) {
  searchInput.value = "";
  statusFilter.value = summaryCard.dataset.status || "all";
  fleetFilter.value = summaryCard.dataset.fleet || "all";
  rankFilter.value = summaryCard.dataset.rank || "all";
  render();
}

function startNewProfile() {
  isAddingProfile = true;
  selectedStaffNo = "";
  renderEditForm(createBlankProfile(), true);
}

function createBlankProfile() {
  return {
    staffNo: "",
    name: "",
    address: "",
    remarks: "Active pilot profile",
    rank: "First Officer",
    fleet: "B737-800",
    nationality: "",
    email: "",
    active: true,
  };
}

function fleetOption(value, selectedFleet) {
  const selected = value === selectedFleet ? "selected" : "";
  return `<option value="${escapeAttribute(value)}" ${selected}>${escapeHtml(value)}</option>`;
}

function rankOption(value, selectedRank) {
  const selected = value === selectedRank ? "selected" : "";
  return `<option value="${escapeAttribute(value)}" ${selected}>${escapeHtml(value)}</option>`;
}

function renderDetails(profile) {
  if (!profile) {
    profileDetails.className = "details-empty";
    profileDetails.textContent = profiles.length ? "No profile matches the current filter." : "Select a profile after uploading the CSV.";
    return;
  }

  profileDetails.className = "detail-card";
  profileDetails.innerHTML = `
    <div class="detail-head">
      <span class="avatar">${initials(profile.name)}</span>
      <div>
        <h3>${escapeHtml(profile.name)}</h3>
        <p class="profile-meta">${escapeHtml(profile.rank)} | ${escapeHtml(profile.fleet)}</p>
      </div>
    </div>
    <div class="profile-actions">
      <button class="edit-button" type="button" data-action="edit">Edit profile</button>
      <button class="toggle-status-button" type="button" data-action="toggle-status">
        Mark ${profile.active ? "Inactive" : "Active"}
      </button>
      <button class="delete-profile-button" type="button" data-action="delete-profile">Delete profile</button>
    </div>
    <dl class="detail-list">
      <div>
        <dt>Staff Number</dt>
        <dd>${escapeHtml(profile.staffNo)}</dd>
      </div>
      <div>
        <dt>Address</dt>
        <dd>${escapeHtml(profile.address)}</dd>
      </div>
      <div>
        <dt>Email</dt>
        <dd>${escapeHtml(profile.email)}</dd>
      </div>
      <div>
        <dt>Nationality</dt>
        <dd>${escapeHtml(profile.nationality)}</dd>
      </div>
      <div>
        <dt>Remarks</dt>
        <dd class="${profile.active ? "" : "notice"}">${escapeHtml(profile.remarks)}</dd>
      </div>
    </dl>
  `;
}

function renderEditForm(profile, isNewProfile = false) {
  profileDetails.className = "detail-card";
  profileDetails.innerHTML = `
    <form class="edit-form" id="edit-profile-form">
      <div class="detail-head">
        <span class="avatar">${initials(profile.name)}</span>
        <div>
          <h3>${isNewProfile ? "Add pilot profile" : "Edit profile"}</h3>
          <p class="profile-meta">${isNewProfile ? "New pilot" : escapeHtml(profile.staffNo)}</p>
        </div>
      </div>

      <label>
        Name
        <input name="name" value="${escapeAttribute(profile.name)}" required />
      </label>

      <label>
        Staff Number
        <input name="staffNo" value="${escapeAttribute(profile.staffNo)}" required />
      </label>

      <label>
        Rank
        <select name="rank">
          ${RANK_OPTIONS.map((rank) => rankOption(rank, profile.rank)).join("")}
        </select>
      </label>

      <label>
        Fleet
        <select name="fleet">
          ${FLEET_OPTIONS.map((fleet) => fleetOption(fleet, profile.fleet)).join("")}
        </select>
      </label>

      <label>
        Address
        <textarea name="address" rows="3">${escapeHtml(profile.address)}</textarea>
      </label>

      <label>
        Email
        <input name="email" type="email" value="${escapeAttribute(profile.email)}" />
      </label>

      <label>
        Nationality
        <input name="nationality" value="${escapeAttribute(profile.nationality)}" />
      </label>

      <label>
        Remarks
        <textarea name="remarks" rows="3">${escapeHtml(profile.remarks)}</textarea>
      </label>

      <label>
        Status
        <select name="active">
          <option value="true" ${profile.active ? "selected" : ""}>Active</option>
          <option value="false" ${profile.active ? "" : "selected"}>Inactive</option>
        </select>
      </label>

      <div class="form-actions">
        <button class="save-button" type="submit">${isNewProfile ? "Add pilot" : "Save changes"}</button>
        <button class="cancel-button" type="button" data-action="cancel">Cancel</button>
      </div>
    </form>
  `;
}

async function handleDetailsClick(event) {
  const actionButton = event.target.closest("[data-action]");
  if (!actionButton) {
    return;
  }

  if (actionButton.dataset.action === "apply-import") {
    await applyPendingImport();
    return;
  }

  if (actionButton.dataset.action === "cancel-import") {
    pendingImport = null;
    render();
    return;
  }

  if (actionButton.dataset.action === "cancel") {
    render();
    return;
  }

  const selected = profiles.find((profile) => profile.staffNo === selectedStaffNo);
  if (!selected) {
    return;
  }

  if (actionButton.dataset.action === "edit") {
    renderEditForm(selected);
  }

  if (actionButton.dataset.action === "delete-profile") {
    deleteSelectedProfile(selected);
  }

  if (actionButton.dataset.action === "toggle-status") {
    toggleSelectedProfileStatus(selected);
  }

}

async function applyPendingImport() {
  if (!pendingImport) {
    return;
  }

  try {
    profiles = pendingImport.profiles;
    selectedStaffNo = profiles[0]?.staffNo || "";
    console.log("Applying import with", profiles.length, "profiles");
    pendingImport = null;
    await saveProfiles();
    console.log("Import applied and saved");
    alert(`Successfully imported ${profiles.length} profiles!`);
    render();
  } catch (error) {
    console.error("Error applying import:", error);
    alert(`Error: ${error.message}`);
    // Restore pending import on failure
    pendingImport = { profiles: profiles };
  }
}

function exportProfilesCsv() {
  if (!profiles.length) {
    window.alert("No pilot profiles to export.");
    return;
  }

  const rows = profiles.map((profile) => [
    profile.staffNo,
    profile.name,
    profile.rank,
    profile.fleet,
    profile.active ? "Active" : "Inactive",
    profile.address,
    profile.email,
    profile.nationality,
    profile.remarks,
  ]);
  const csv = [EXPORT_HEADERS, ...rows].map((row) => row.map(csvCell).join(",")).join("\n");
  const blob = new Blob([`\uFEFF${csv}`], { type: "text/csv;charset=utf-8" });
  const downloadLink = document.createElement("a");

  downloadLink.href = URL.createObjectURL(blob);
  downloadLink.download = `pilot-profiles-${new Date().toISOString().slice(0, 10)}.csv`;
  document.body.appendChild(downloadLink);
  downloadLink.click();
  downloadLink.remove();
  URL.revokeObjectURL(downloadLink.href);
}

function csvCell(value) {
  return `"${String(value || "").replaceAll('"', '""')}"`;
}

function toggleSelectedProfileStatus(profile) {
  const selectedIndex = profiles.findIndex((savedProfile) => savedProfile.staffNo === profile.staffNo);
  if (selectedIndex === -1) {
    return;
  }

  profiles[selectedIndex] = {
    ...profiles[selectedIndex],
    active: !profiles[selectedIndex].active,
    remarks: profiles[selectedIndex].active ? profiles[selectedIndex].remarks : "Active pilot profile",
  };
  saveProfiles();
  render();
}

function deleteSelectedProfile(profile) {
  const shouldDelete = window.confirm(`Delete ${profile.name} from the dashboard?`);
  if (!shouldDelete) {
    return;
  }

  profiles = profiles.filter((savedProfile) => savedProfile.staffNo !== profile.staffNo);
  selectedStaffNo = profiles[0]?.staffNo || "";
  saveProfiles();
  render();
}

function handleProfileSave(event) {
  if (event.target.id !== "edit-profile-form") {
    return;
  }

  event.preventDefault();

  const form = new FormData(event.target);
  const selectedIndex = profiles.findIndex((profile) => profile.staffNo === selectedStaffNo);
  const staffNo = clean(form.get("staffNo"));

  if (!staffNo) {
    window.alert("Staff Number is required.");
    return;
  }

  if (profiles.some((profile, index) => profile.staffNo === staffNo && (isAddingProfile || index !== selectedIndex))) {
    window.alert("A pilot with this staff number already exists.");
    return;
  }

  if (!isAddingProfile && selectedIndex === -1) {
    return;
  }

  const updatedProfile = {
    ...(isAddingProfile ? createBlankProfile() : profiles[selectedIndex]),
    name: clean(form.get("name")),
    staffNo,
    rank: clean(form.get("rank")) || "Rank not recorded",
    fleet: clean(form.get("fleet")) || "Fleet not recorded",
    address: clean(form.get("address")) || "No address recorded",
    email: clean(form.get("email")) || "Email not recorded",
    nationality: clean(form.get("nationality")) || "Nationality not recorded",
    remarks: clean(form.get("remarks")) || "No remarks recorded",
    active: form.get("active") === "true",
  };

  if (isAddingProfile) {
    profiles.push(updatedProfile);
    isAddingProfile = false;
  } else {
    profiles[selectedIndex] = updatedProfile;
  }

  selectedStaffNo = updatedProfile.staffNo;
  saveProfiles();
  render();
}

function restoreSavedProfiles() {
  try {
    const savedProfiles = JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]");
    if (Array.isArray(savedProfiles)) {
      profiles = savedProfiles;
      selectedStaffNo = localStorage.getItem(SELECTED_KEY) || (profiles[0]?.staffNo || "");
    }
  } catch (error) {
    console.error('Failed to restore profiles:', error);
    profiles = [];
    selectedStaffNo = "";
  }

  render();
}

function saveProfiles() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(profiles));
  localStorage.setItem(SELECTED_KEY, selectedStaffNo);
  return true;
}

function clearSavedProfiles() {
  localStorage.removeItem(STORAGE_KEY);
  localStorage.removeItem(SELECTED_KEY);
  localStorage.removeItem(ACTIVE_RESET_KEY);
}

function initials(name) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() || "")
    .join("");
}

function clean(value) {
  return String(value || "").replace(/^\uFEFF/, "").trim();
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function escapeAttribute(value) {
  return escapeHtml(value);
}
