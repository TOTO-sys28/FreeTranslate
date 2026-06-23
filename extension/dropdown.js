/**
 * Custom Dropdown Component for Extension Popup
 * Simplified version without search functionality
 */

class CustomDropdown {
  constructor(element) {
    this.element = element;
    this.trigger = element.querySelector('.dropdown-trigger');
    this.menu = element.querySelector('.dropdown-menu');
    this.hiddenInput = element.querySelector('input[type="hidden"]');
    this.valueDisplay = element.querySelector('.dropdown-value');
    
    this.items = [];
    this.isOpen = false;
    this.selectedIndex = -1;
    
    this.init();
  }
  
  init() {
    this.updateItemsFromMenu();
    
    this.trigger.addEventListener('click', (e) => {
      e.stopPropagation();
      this.toggle();
    });
    
    this.element.addEventListener('keydown', (e) => this.handleKeyDown(e));
    
    this.menu.addEventListener('click', (e) => {
      const item = e.target.closest('.dropdown-item');
      if (item) {
        this.selectItem(item);
      }
    });
    
    document.addEventListener('click', (e) => {
      if (!this.element.contains(e.target)) {
        this.close();
      }
    });
    
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
  }
  
  close() {
    this.isOpen = false;
    this.element.setAttribute('aria-expanded', 'false');
  }
  
  selectItem(item) {
    this.items.forEach(i => {
      i.classList.remove('selected');
      i.classList.remove('highlighted');
    });
    
    item.classList.add('selected');
    
    const value = item.dataset.value;
    const label = item.textContent;
    this.valueDisplay.textContent = label;
    
    this.hiddenInput.value = value;
    
    this.selectedIndex = this.items.indexOf(item);
    
    this.hiddenInput.dispatchEvent(new Event('change', { bubbles: true }));
    
    this.close();
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
        if (this.selectedIndex >= 0) {
          this.selectItem(this.items[this.selectedIndex]);
        }
        break;
    }
  }
  
  navigateNext() {
    const nextIndex = (this.selectedIndex + 1) % this.items.length;
    this.highlightItem(this.items[nextIndex]);
  }
  
  navigatePrevious() {
    const prevIndex = (this.selectedIndex - 1 + this.items.length) % this.items.length;
    this.highlightItem(this.items[prevIndex]);
  }
  
  highlightItem(item) {
    this.items.forEach(i => i.classList.remove('highlighted'));
    
    item.classList.add('highlighted');
    
    this.selectedIndex = this.items.indexOf(item);
    
    item.scrollIntoView({ block: 'nearest' });
  }
}

document.addEventListener('DOMContentLoaded', () => {
  const triggerModeDropdown = new CustomDropdown(document.getElementById('trigger-mode-dropdown'));
  const targetLangDropdown = new CustomDropdown(document.getElementById('target-lang-dropdown'));
  
  window.customDropdowns = {
    triggerMode: triggerModeDropdown,
    targetLang: targetLangDropdown
  };
});
