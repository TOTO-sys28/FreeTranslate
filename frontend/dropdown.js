/**
 * Custom Dropdown Component
 * Handles custom dropdown functionality with keyboard navigation and search
 */

class CustomDropdown {
  constructor(element, options = {}) {
    this.element = element;
    this.trigger = element.querySelector('.dropdown-trigger');
    this.menu = element.querySelector('.dropdown-menu');
    this.hiddenInput = element.querySelector('input[type="hidden"]');
    this.valueDisplay = element.querySelector('.dropdown-value');
    
    this.options = options;
    this.items = [];
    this.isOpen = false;
    this.selectedIndex = -1;
    
    this.init();
  }
  
  init() {
    // Get initial items from menu
    this.updateItemsFromMenu();
    
    // Add click handler to trigger
    this.trigger.addEventListener('click', (e) => {
      e.stopPropagation();
      this.toggle();
    });
    
    // Add keyboard navigation to trigger
    this.element.addEventListener('keydown', (e) => this.handleKeyDown(e));
    
    // Add click handlers to menu items
    this.menu.addEventListener('click', (e) => {
      const item = e.target.closest('.dropdown-item');
      if (item) {
        this.selectItem(item);
      }
    });
    
    // Close on outside click
    document.addEventListener('click', (e) => {
      if (!this.element.contains(e.target)) {
        this.close();
      }
    });
    
    // Set initial value
    const initialValue = this.hiddenInput.value;
    if (initialValue) {
      this.selectByValue(initialValue);
    }
  }
  
  updateItemsFromMenu() {
    this.items = Array.from(this.menu.querySelectorAll('.dropdown-item'));
  }
  
  toggle() {
    if (this.isOpen) {
      this.close();
    } else {
      this.open();
    }
  }
  
  open() {
    this.isOpen = true;
    this.element.setAttribute('aria-expanded', 'true');
    
    // Add search if enabled and there are many items
    if (this.options.enableSearch && this.items.length > 10) {
      this.addSearch();
    }
  }
  
  close() {
    this.isOpen = false;
    this.element.setAttribute('aria-expanded', 'false');
    
    // Remove search if it exists
    const search = this.menu.querySelector('.dropdown-search');
    if (search) {
      search.remove();
    }
    
    // Reset hidden items
    this.items.forEach(item => item.classList.remove('hidden'));
  }
  
  selectItem(item) {
    // Remove selected class from all items
    this.items.forEach(i => i.classList.remove('selected'));
    
    // Add selected class to clicked item
    item.classList.add('selected');
    
    // Update value display
    const value = item.dataset.value;
    const label = item.textContent;
    this.valueDisplay.textContent = label;
    
    // Update hidden input
    this.hiddenInput.value = value;
    
    // Update selected index
    this.selectedIndex = this.items.indexOf(item);
    
    // Trigger change event
    this.hiddenInput.dispatchEvent(new Event('change', { bubbles: true }));
    
    // Close dropdown
    this.close();
    
    // Call callback if provided
    if (this.options.onChange) {
      this.options.onChange(value, label);
    }
  }
  
  selectByValue(value) {
    const item = this.items.find(i => i.dataset.value === value);
    if (item) {
      this.selectItem(item);
    }
  }
  
  getValue() {
    return this.hiddenInput.value;
  }
  
  setValue(value) {
    this.selectByValue(value);
  }
  
  setOptions(options) {
    // Clear existing items (except search)
    const existingItems = this.menu.querySelectorAll('.dropdown-item');
    existingItems.forEach(item => item.remove());
    
    // Add new items
    options.forEach(opt => {
      const item = document.createElement('div');
      item.className = 'dropdown-item';
      item.dataset.value = opt.value;
      item.textContent = opt.label;
      item.setAttribute('role', 'option');
      this.menu.appendChild(item);
    });
    
    // Update items reference
    this.updateItemsFromMenu();
  }
  
  addSearch() {
    // Don't add if already exists
    if (this.menu.querySelector('.dropdown-search')) return;
    
    const searchDiv = document.createElement('div');
    searchDiv.className = 'dropdown-search';
    
    const searchInput = document.createElement('input');
    searchInput.type = 'text';
    searchInput.placeholder = 'Search languages...';
    searchInput.addEventListener('input', (e) => this.filterItems(e.target.value));
    searchInput.addEventListener('keydown', (e) => this.handleSearchKeyDown(e));
    
    searchDiv.appendChild(searchInput);
    this.menu.insertBefore(searchDiv, this.menu.firstChild);
    
    // Focus search input
    setTimeout(() => searchInput.focus(), 100);
  }
  
  filterItems(query) {
    const lowerQuery = query.toLowerCase();
    
    this.items.forEach(item => {
      const label = item.textContent.toLowerCase();
      if (label.includes(lowerQuery)) {
        item.classList.remove('hidden');
      } else {
        item.classList.add('hidden');
      }
    });
  }
  
  handleKeyDown(e) {
    if (!this.isOpen) {
      if (e.key === 'Enter' || e.key === ' ' || e.key === 'ArrowDown') {
        e.preventDefault();
        this.open();
      }
      return;
    }
    
    switch (e.key) {
      case 'Escape':
        e.preventDefault();
        this.close();
        break;
        
      case 'ArrowDown':
        e.preventDefault();
        this.navigateNext();
        break;
        
      case 'ArrowUp':
        e.preventDefault();
        this.navigatePrevious();
        break;
        
      case 'Enter':
        e.preventDefault();
        if (this.selectedIndex >= 0 && !this.items[this.selectedIndex].classList.contains('hidden')) {
          this.selectItem(this.items[this.selectedIndex]);
        }
        break;
        
      case 'Home':
        e.preventDefault();
        this.selectFirstVisible();
        break;
        
      case 'End':
        e.preventDefault();
        this.selectLastVisible();
        break;
    }
  }
  
  handleSearchKeyDown(e) {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      this.navigateNext();
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      this.navigatePrevious();
    }
  }
  
  navigateNext() {
    const visibleItems = this.items.filter(i => !i.classList.contains('hidden'));
    if (visibleItems.length === 0) return;
    
    if (this.selectedIndex < 0) {
      this.selectFirstVisible();
    } else {
      const currentIndex = visibleItems.indexOf(this.items[this.selectedIndex]);
      const nextIndex = (currentIndex + 1) % visibleItems.length;
      this.highlightItem(visibleItems[nextIndex]);
    }
  }
  
  navigatePrevious() {
    const visibleItems = this.items.filter(i => !i.classList.contains('hidden'));
    if (visibleItems.length === 0) return;
    
    if (this.selectedIndex < 0) {
      this.selectLastVisible();
    } else {
      const currentIndex = visibleItems.indexOf(this.items[this.selectedIndex]);
      const prevIndex = (currentIndex - 1 + visibleItems.length) % visibleItems.length;
      this.highlightItem(visibleItems[prevIndex]);
    }
  }
  
  selectFirstVisible() {
    const visibleItems = this.items.filter(i => !i.classList.contains('hidden'));
    if (visibleItems.length > 0) {
      this.highlightItem(visibleItems[0]);
    }
  }
  
  selectLastVisible() {
    const visibleItems = this.items.filter(i => !i.classList.contains('hidden'));
    if (visibleItems.length > 0) {
      this.highlightItem(visibleItems[visibleItems.length - 1]);
    }
  }
  
  highlightItem(item) {
    // Remove highlight from all items
    this.items.forEach(i => i.classList.remove('highlighted'));
    
    // Add highlight to selected item
    item.classList.add('highlighted');
    
    // Update selected index
    this.selectedIndex = this.items.indexOf(item);
    
    // Scroll into view
    item.scrollIntoView({ block: 'nearest' });
  }
}

// Initialize all custom dropdowns on page load
document.addEventListener('DOMContentLoaded', () => {
  // Language dropdowns with search enabled
  const sourceLangDropdown = new CustomDropdown(document.getElementById('source-lang-dropdown'), {
    enableSearch: true,
    onChange: (value, label) => {
      // Trigger directionality update
      const event = new CustomEvent('languageChange', { detail: { type: 'source', value, label } });
      document.dispatchEvent(event);
    }
  });
  
  const targetLangDropdown = new CustomDropdown(document.getElementById('target-lang-dropdown'), {
    enableSearch: true,
    onChange: (value, label) => {
      // Trigger directionality update
      const event = new CustomEvent('languageChange', { detail: { type: 'target', value, label } });
      document.dispatchEvent(event);
    }
  });
  
  // Model dropdown without search
  const modelDropdown = new CustomDropdown(document.getElementById('model-dropdown'), {
    enableSearch: false,
    onChange: (value, label) => {
      // Trigger model change
      const event = new CustomEvent('modelChange', { detail: { value, label } });
      document.dispatchEvent(event);
    }
  });
  
  // Expose dropdowns globally for app.js to use
  window.customDropdowns = {
    source: sourceLangDropdown,
    target: targetLangDropdown,
    model: modelDropdown
  };
});

// Add highlight styles dynamically
const style = document.createElement('style');
style.textContent = `
  .dropdown-item.highlighted {
    background: rgba(255, 255, 255, 0.1);
    color: var(--text-primary);
  }
`;
document.head.appendChild(style);
