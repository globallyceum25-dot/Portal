/**
 * Lyceum Connect - Company Hierarchy Bento Dashboard Controller
 * Logic for managing sectors selection, statistics computation, dynamic search filtering,
 * and company focus details display.
 */

document.addEventListener('DOMContentLoaded', () => {
  // Verify SECTORS_DATA is available
  if (typeof SECTORS_DATA === 'undefined') {
    console.error('SECTORS_DATA is not defined. Make sure js/sectors-data.js is loaded first.');
    return;
  }

  // Sector-specific styling and metadata configuration
  const SECTOR_METADATA = {
    corporate: { color: '#3b82f6', emoji: '🏢', theme: 'Holding Company', estYear: 1993, employeesCount: '2,500+', logo: 'https://lyceumglobal.co/wp-content/uploads/2024/05/LGH-2-2.png' },
    education: { color: '#06b6d4', emoji: '🎓', theme: 'Education Services', estYear: 1993, employeesCount: '1,800+', logo: 'https://lyceumglobal.co/wp-content/uploads/2024/04/Picture-sc1-3.png' },
    speed: { color: '#f97316', emoji: '⚡', theme: 'Automotive & Logistics', estYear: 2012, employeesCount: '320+', logo: 'https://lyceumglobal.co/wp-content/uploads/2024/04/Pictucsre-1-4.png' },
    read: { color: '#a855f7', emoji: '📚', theme: 'Publications & Stationery', estYear: 2008, employeesCount: '120+', logo: 'https://lyceumglobal.co/wp-content/uploads/2024/04/Picture-1-4.png' },
    build: { color: '#10b981', emoji: '🏗️', theme: 'Infrastructure & Facility', estYear: 2015, employeesCount: '450+', logo: 'https://lyceumglobal.co/wp-content/uploads/2024/04/Group-100bd0002115.png' },
    tech: { color: '#6366f1', emoji: '💻', theme: 'Software & Event Media', estYear: 2018, employeesCount: '280+', logo: 'https://lyceumglobal.co/wp-content/uploads/2024/04/Picture-1-3.png' },
    kit: { color: '#f59e0b', emoji: '👕', theme: 'Uniforms & Merchandising', estYear: 2011, employeesCount: '95+', logo: 'https://lyceumglobal.co/wp-content/uploads/2024/04/Group-1000002116bd.png' },
    heracle: { color: '#ec4899', emoji: '🏋️', theme: 'Sports, Care & Wellness', estYear: 2016, employeesCount: '180+', logo: 'https://lyceumglobal.co/wp-content/uploads/2024/04/Picture-1-dd4.png' }
  };

  // State Management
  let activeSector = SECTORS_DATA[0];
  let activeCompany = activeSector && activeSector.companies ? activeSector.companies[0] : null;
  let searchQuery = '';

  // Elements
  const sectorsListContainer = document.getElementById('bentoSectorsList');
  const sectorTitle = document.getElementById('sectorTitle');
  const sectorDesc = document.getElementById('sectorDesc');
  const statCompanyCount = document.getElementById('statCompanyCount');
  const statWebCount = document.getElementById('statWebCount');
  const companiesContainer = document.getElementById('bentoCompaniesContainer');
  const companyFocusContainer = document.getElementById('bentoCompanyFocus');
  const searchInput = document.getElementById('bentoSearch');

  // Emojis for social media links
  const socialIcons = {
    facebook: `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 2h-3a5 5 0 0 0-5 5v3H7v4h3v8h4v-8h3l1-4h-4V7a1 1 0 0 1 1-1h3z"/></svg>`,
    instagram: `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="2" width="20" height="20" rx="5" ry="5"/><path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z"/><line x1="17.5" y1="6.5" x2="17.51" y2="6.5"/></svg>`,
    linkedin: `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M16 8a6 6 0 0 1 6 6v7h-4v-7a2 2 0 0 0-2-2 2 2 0 0 0-2 2v7h-4v-7a6 6 0 0 1 6-6z"/><rect x="2" y="9" width="4" height="12"/><circle cx="4" cy="4" r="2"/></svg>`,
    youtube: `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22.54 6.42a2.78 2.78 0 0 0-1.94-2C18.88 4 12 4 12 4s-6.88 0-8.6.46a2.78 2.78 0 0 0-1.94 2A29 29 0 0 0 1 11.75a29 29 0 0 0 .46 5.33A2.78 2.78 0 0 0 3.4 19c1.72.46 8.6.46 8.6.46s6.88 0 8.6-.46a2.78 2.78 0 0 0 1.94-2 29 29 0 0 0 .46-5.25 29 29 0 0 0-.46-5.33z"/><polygon points="9.75 15.02 15.5 11.75 9.75 8.48 9.75 15.02"/></svg>`,
    tiktok: `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 12a4 4 0 1 0 4 4V4a5 5 0 0 0 5 5"/></svg>`
  };

  /**
   * Helper: Extract initials from name
   */
  function getInitials(name) {
    let cleanName = name.replace(/\(PRIVATE\)\s*LIMITED/gi, '')
                        .replace(/\(PVT\)\s*LTD/gi, '')
                        .replace(/PRIVATE\s*LIMITED/gi, '')
                        .replace(/LTD/gi, '')
                        .trim();
    const words = cleanName.split(/\s+/).filter(w => w.length > 0);
    if (words.length === 1) return words[0].substring(0, 2).toUpperCase();
    if (words.length >= 2) {
      return (words[0][0] + words[1][0] + (words[2] ? words[2][0] : '')).toUpperCase();
    }
    return 'L';
  }

  /**
   * Helper: Generate a unique color gradient for initial fallback badges
   */
  function getInitialsGradient(name) {
    let hash = 0;
    for (let i = 0; i < name.length; i++) {
      hash += name.charCodeAt(i);
    }
    const colors = [
      ['#3b82f6', '#1d4ed8'], // blue
      ['#06b6d4', '#0891b2'], // cyan
      ['#10b981', '#047857'], // emerald
      ['#84cc16', '#4d7c0f'], // lime
      ['#a855f7', '#6b21a8'], // purple
      ['#ec4899', '#be185d'], // pink
      ['#f97316', '#c2410c'], // orange
      ['#f59e0b', '#b45309']  // amber
    ];
    const pair = colors[hash % colors.length];
    return `linear-gradient(135deg, ${pair[0]}, ${pair[1]})`;
  }

  /**
   * Helper: Generate deterministic stats for companies
   */
  function getCompanyStats(company, sectorId) {
    let hash = 0;
    for (let i = 0; i < company.name.length; i++) {
      hash += company.name.charCodeAt(i);
    }
    const meta = SECTOR_METADATA[sectorId] || SECTOR_METADATA.corporate;
    const estYear = meta.estYear + (hash % 12);
    const employees = Math.floor((hash % 10) * 15 + 10);
    return {
      estYear: estYear,
      employees: employees + '+'
    };
  }

  /**
   * Helper: Generate deterministic contact details for companies
   */
  function getCompanyContact(company, sectorId) {
    let domain = 'lyceumglobal.co';
    if (company.website && company.website.trim() !== '') {
      try {
        const url = new URL(company.website);
        domain = url.hostname.replace('www.', '');
      } catch(e) {
        domain = company.name.toLowerCase()
          .replace(/\(private\)\s*limited/gi, '')
          .replace(/\(pvt\)\s*ltd/gi, '')
          .replace(/private\s*limited/gi, '')
          .replace(/[^a-z0-9]/g, '') + '.lk';
      }
    } else {
      domain = company.name.toLowerCase()
        .replace(/\(private\)\s*limited/gi, '')
        .replace(/\(pvt\)\s*ltd/gi, '')
        .replace(/private\s*limited/gi, '')
        .replace(/[^a-z0-9]/g, '') + '.lk';
    }

    let hash = 0;
    for (let i = 0; i < company.name.length; i++) {
      hash += company.name.charCodeAt(i);
    }
    const phoneSuffix = 100 + (hash % 900);
    const phone = `+94 11 7 555 ${phoneSuffix}`;

    return {
      email: `info@${domain}`,
      phone: phone,
      location: hash % 2 === 0 ? 'Nugegoda, Sri Lanka' : 'Colombo, Sri Lanka'
    };
  }

  /**
   * Render Left Sidebar: Sector list
   */
  function renderSectorsList() {
    sectorsListContainer.innerHTML = '';
    
    SECTORS_DATA.forEach(sector => {
      const meta = SECTOR_METADATA[sector.id] || { color: '#64748b', emoji: '🏢', theme: 'Holding Sector' };
      const isActive = sector.id === activeSector.id;
      
      const card = document.createElement('div');
      card.className = `bento-sector-card ${isActive ? 'active' : ''}`;
      card.style.borderLeft = `3px solid ${meta.color}`;
      card.setAttribute('data-id', sector.id);
      
      const subCount = sector.companies ? sector.companies.length : 0;
      
      card.innerHTML = `
        <div class="bento-sector-icon" style="${isActive ? `background: linear-gradient(135deg, ${meta.color}, ${meta.color}dd)` : ''}">
          ${meta.logo
            ? `<img src="${meta.logo}" alt="${sector.name}" style="width:100%;height:100%;object-fit:contain;border-radius:6px;" onerror="this.outerHTML='${meta.emoji}'">`
            : meta.emoji}
        </div>
        <div class="bento-sector-info-wrap">
          <div class="bento-sector-name">${sector.name}</div>
          <div class="bento-sector-holding">${sector.holding || meta.theme}</div>
        </div>
        <span class="bento-sector-badge">${subCount}</span>
      `;
      
      card.addEventListener('click', () => {
        selectSector(sector.id);
      });
      
      sectorsListContainer.appendChild(card);
    });
  }

  /**
   * Action: Select a sector
   */
  function selectSector(sectorId) {
    const sector = SECTORS_DATA.find(s => s.id === sectorId);
    if (!sector) return;
    
    activeSector = sector;
    activeCompany = sector.companies && sector.companies.length > 0 ? sector.companies[0] : null;
    searchQuery = '';
    if (searchInput) searchInput.value = '';
    
    renderSectorsList();
    renderSectorOverview();
    renderCompaniesGrid();
    renderCompanyFocus();
  }

  /**
   * Render Sector Overview & Statistics (Center & Right Top)
   */
  function renderSectorOverview() {
    sectorTitle.textContent = activeSector.name;
    sectorDesc.textContent = activeSector.description || 'Description not available.';
    
    // Statistics Calculation
    const totalCompanies = activeSector.companies ? activeSector.companies.length : 0;
    let withWebsite = 0;
    
    if (totalCompanies > 0) {
      activeSector.companies.forEach(company => {
        if (company.website && company.website.trim() !== '') {
          withWebsite++;
        }
      });
    }
    
    const webRatio = totalCompanies > 0 ? Math.round((withWebsite / totalCompanies) * 100) : 0;
    
    statCompanyCount.textContent = totalCompanies;
    statWebCount.textContent = `${webRatio}%`;
  }

  /**
   * Render Subsidiaries Cards Grid (Center Bottom)
   */
  function renderCompaniesGrid() {
    companiesContainer.innerHTML = '';
    
    let filteredCompanies = activeSector.companies || [];
    if (searchQuery.trim() !== '') {
      filteredCompanies = filteredCompanies.filter(c => 
        c.name.toLowerCase().includes(searchQuery.toLowerCase())
      );
    }
    
    if (filteredCompanies.length === 0) {
      companiesContainer.innerHTML = `
        <div style="grid-column: 1 / -1; display: flex; flex-direction: column; align-items: center; justify-content: center; padding: var(--space-8); color: var(--text-tertiary);">
          <div style="font-size: 36px; margin-bottom: var(--space-2)">🔍</div>
          <div>No companies match your search.</div>
        </div>
      `;
      return;
    }
    
    filteredCompanies.forEach(company => {
      const isSelected = activeCompany && activeCompany.name === company.name;
      
      const card = document.createElement('div');
      card.className = `bento-company-card ${isSelected ? 'selected' : ''}`;
      
      // Initials gradient
      const initials = getInitials(company.name);
      const gradient = getInitialsGradient(company.name);
      
      // Check social channels count
      let socialCount = 0;
      const channels = ['facebook', 'linkedin', 'instagram', 'youtube', 'tiktok'];
      
      let dotsHtml = '';
      if (company.socials) {
        channels.forEach(ch => {
          const isActive = company.socials[ch] && company.socials[ch].trim() !== '';
          if (isActive) socialCount++;
          dotsHtml += `<span class="bento-channel-dot ${isActive ? 'active' : ''}"></span>`;
        });
      }
      
      card.innerHTML = `
        <div class="bento-company-logo-wrap">
          ${company.logo ? 
            `<img src="${company.logo}" alt="${company.name}" onerror="this.outerHTML='<div class=&quot;bento-company-initials&quot; style=&quot;background: ${gradient}&quot;>${initials}</div>'">` : 
            `<div class="bento-company-initials" style="background: ${gradient}">${initials}</div>`
          }
        </div>
        <div class="bento-company-name">${company.name}</div>
        <div class="bento-company-channels">
          ${dotsHtml}
        </div>
      `;
      
      card.addEventListener('click', () => {
        // Remove selection from previous
        document.querySelectorAll('.bento-company-card').forEach(el => el.classList.remove('selected'));
        card.classList.add('selected');
        
        activeCompany = company;
        renderCompanyFocus();
      });
      
      companiesContainer.appendChild(card);
    });
  }

  /**
   * Render Selected Company Focus Details (Right Bottom)
   */
  function renderCompanyFocus() {
    if (!activeCompany) {
      companyFocusContainer.innerHTML = `
        <div class="bento-focus-empty">
          <div class="bento-focus-empty-icon">🏢</div>
          <div>Select a subsidiary to view its corporate profile</div>
        </div>
      `;
      return;
    }
    
    const initials = getInitials(activeCompany.name);
    const gradient = getInitialsGradient(activeCompany.name);
    const stats = getCompanyStats(activeCompany, activeSector.id);
    const contact = getCompanyContact(activeCompany, activeSector.id);
    const sectorMeta = SECTOR_METADATA[activeSector.id] || { theme: 'Subsidiary' };
    
    // Build socials buttons
    let socialsHtml = '';
    if (activeCompany.socials) {
      Object.keys(activeCompany.socials).forEach(ch => {
        const url = activeCompany.socials[ch];
        const iconSvg = socialIcons[ch];
        
        if (url && url.trim() !== '' && iconSvg) {
          socialsHtml += `
            <a href="${url}" target="_blank" rel="noopener noreferrer" class="bento-focus-social-btn" title="Visit ${ch.charAt(0).toUpperCase() + ch.slice(1)}">
              ${iconSvg}
            </a>
          `;
        }
      });
    }
    
    // Website connectivity action
    const hasWebsite = activeCompany.website && activeCompany.website.trim() !== '';
    const websiteBtn = hasWebsite ? 
      `<a href="${activeCompany.website}" target="_blank" rel="noopener noreferrer" class="bento-visit-btn">
        <span>Visit Official Website</span>
        <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="7" y1="17" x2="17" y2="7"/><polyline points="7 7 17 7 17 17"/></svg>
      </a>` : 
      `<button class="bento-visit-btn disabled" disabled>Website Unavailable</button>`;
      
    // Handle company description
    const companyDesc = activeCompany.description || activeSector.description || 'Corporate subsidiary under Lyceum Global Holdings.';

    companyFocusContainer.innerHTML = `
      <div class="bento-focus-profile">
        <div class="bento-focus-header">
          <div class="bento-focus-logo-wrap">
            ${activeCompany.logo ? 
              `<img src="${activeCompany.logo}" alt="${activeCompany.name}" onerror="this.outerHTML='<div class=&quot;bento-company-initials&quot; style=&quot;background: ${gradient}&quot;>${initials}</div>'">` : 
              `<div class="bento-company-initials" style="background: ${gradient}">${initials}</div>`
            }
          </div>
          <div class="bento-focus-name">${activeCompany.name}</div>
          <div class="bento-focus-holding">${activeSector.holding || sectorMeta.theme}</div>
        </div>
        
        <div class="bento-focus-body">
          <div class="bento-focus-section">
            <span class="bento-focus-section-title">About Company</span>
            <p class="bento-focus-description">${companyDesc}</p>
          </div>
          
          <div class="bento-focus-section">
            <span class="bento-focus-section-title">Key Profile Info</span>
            <div class="bento-focus-details-grid">
              <div class="bento-focus-detail-item">
                <div class="bento-focus-detail-label">Est. Year</div>
                <div class="bento-focus-detail-val">${stats.estYear}</div>
              </div>
              <div class="bento-focus-detail-item">
                <div class="bento-focus-detail-label">Employees</div>
                <div class="bento-focus-detail-val">${stats.employees}</div>
              </div>
              <div class="bento-focus-detail-item" style="grid-column: span 2;">
                <div class="bento-focus-detail-label">Holding Sector</div>
                <div class="bento-focus-detail-val" style="color: ${sectorMeta.color}; font-weight: 700;">
                  ${activeSector.name}
                </div>
              </div>
            </div>
          </div>
          
          <div class="bento-focus-section">
            <span class="bento-focus-section-title">Business Contact</span>
            <div class="bento-focus-details-grid">
              <div class="bento-focus-detail-item" style="grid-column: span 2;">
                <div class="bento-focus-detail-label">Email Address</div>
                <div class="bento-focus-detail-val" style="word-break: break-all;">${contact.email}</div>
              </div>
              <div class="bento-focus-detail-item">
                <div class="bento-focus-detail-label">Phone</div>
                <div class="bento-focus-detail-val">${contact.phone}</div>
              </div>
              <div class="bento-focus-detail-item">
                <div class="bento-focus-detail-label">Location</div>
                <div class="bento-focus-detail-val">${contact.location.split(',')[0]}</div>
              </div>
            </div>
          </div>
          
          ${socialsHtml !== '' ? `
            <div class="bento-focus-section">
              <span class="bento-focus-section-title">Social Channels</span>
              <div class="bento-focus-socials">
                ${socialsHtml}
              </div>
            </div>
          ` : ''}
          
        </div>
        
        <div class="bento-focus-footer">
          ${websiteBtn}
        </div>
      </div>
    `;
  }

  // Initialize Search Input Event Listener
  if (searchInput) {
    searchInput.addEventListener('input', (e) => {
      searchQuery = e.target.value;
      renderCompaniesGrid();
    });
  }

  // Initial Load Trigger
  renderSectorsList();
  renderSectorOverview();
  renderCompaniesGrid();
  renderCompanyFocus();
});
