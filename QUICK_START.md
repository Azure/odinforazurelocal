# Quick Start Guide - Azure Local Wizard

## 🚀 Getting Started

The Azure Local Wizard helps you configure Azure Local deployments through an interactive step-by-step process.

### Launch the Wizard
1. Open `index.html` in your browser, or
2. Run `.\tests\serve.ps1` and visit `http://localhost:5500`

### Before You Start
- **📋 View Prerequisites** - Blue button shows hardware/network/Azure requirements

---

## 📖 Key Features

### Header Actions (Top Right)
- **📁 Import Config** - Load a previously saved configuration
- **💾 Export Config** - Save your current configuration as JSON
- **🔢 CIDR Calculator** - Calculate subnet details
- **💰 Cost Estimate** - Get rough monthly cost estimates
- **📦 Sizer Tool** - Size your Azure Local deployment

### During Configuration
- **Compare Options** buttons - Available on Storage, Outbound, and Arc Gateway steps
- **Auto-Save** - Progress automatically saved to your browser
- **Real-time Validation** - Instant feedback on all inputs

### After Configuration
- **Resume Session** - Return anytime and pick up where you left off
- **Generate Report** - Detailed configuration document
- **Generate ARM Parameters** - For deployment automation

---

## 🎯 Workflow

1. **Review Prerequisites** (click button)
2. **Start Configuration** (answer wizard questions)
3. **Compare Options** (when deciding between choices)
4. **Use CIDR Calculator** (for IP planning)
5. **Check Cost Estimate** (for budgeting)
6. **Export Config** (to save or share)
7. **Generate Report** (detailed configuration document)
8. **Generate ARM Parameters** (for deployment)

---

## 💡 Pro Tips

### Saving Your Work
Your progress is **automatically saved** after every change. No manual save needed!

### Sharing Configurations
1. Click **Export Config**
2. Share the JSON file with your team
3. They click **Import Config** to load it

### Avoid IP Conflicts
Use the CIDR Calculator to verify subnets don't overlap.

### Plan for Growth
Size your infrastructure IP pool with extra capacity.

### Document Everything
Export your config regularly - it includes all your decisions.

---

## 🔑 Keyboard Shortcuts

- **Tab** - Navigate between fields
- **Enter** - Select focused option
- **Escape** - Close modals (when open)

---

## 🐛 Troubleshooting

### Resume Banner Not Showing?
- Check if localStorage is enabled
- Private/Incognito mode disables auto-save
- Clear cache and try again

### Export Not Working?
- Check browser console for errors
- Disable pop-up blocker
- Try a different browser

### Import Failed?
- Verify file is valid JSON
- Check version compatibility
- Look for error message in toast

### Validation Errors?
- Read the inline error message
- Check format examples in placeholders
- Use CIDR Calculator for IP addresses

---

## 📚 Project Structure

```
odinforazurelocal/
├── index.html          # Main wizard
├── arm/                # ARM parameter generator
├── report/             # Report generator
├── sizer/              # Deployment sizer tool
├── js/                 # JavaScript modules
├── css/                # Stylesheets
├── images/             # Logo and assets
├── tests/              # Unit tests and dev server
└── docs/               # Additional documentation
```

---

## ⚡ Quick Actions

| Action | Location | Description |
|--------|----------|-------------|
| Export Config | Header | Save configuration as JSON |
| Import Config | Header | Load saved configuration |
| CIDR Calculator | Header | IP/subnet calculator |
| Cost Estimate | Header | Rough monthly estimates |
| Prerequisites | Above wizard | Requirements checklist |
| Compare Options | Step headers | Compare configuration choices |
| Sizer | Header | Size your deployment |

---

## 🎨 Visual Cues

- **Blue** - Information, calculators, comparisons
- **Green** - Success messages, cost estimates
- **Red** - Errors, validation failures
- **Purple** - Important sections, highlights
- **Gray** - Disabled options

---

## 📱 Browser Support

✅ Chrome/Edge 90+  
✅ Firefox 88+  
✅ Safari 14+  
✅ Opera 76+  
❌ Internet Explorer (not supported)

---

## 🔒 Privacy

- All data stored **locally** in your browser
- No data sent to external servers
- Clear localStorage to remove all data
- Exports contain configuration only (no credentials)

---

## 📞 Support

- **GitHub Issues** - Report bugs or request features
- **Documentation** - Check README.md
- **Unit Tests** - Open tests/tests.html to verify functionality
- **Azure Docs** - [learn.microsoft.com/azure-stack/hci/](https://learn.microsoft.com/azure-stack/hci/)

---

## ✨ What's Next?

After completing the wizard:
1. Review generated report
2. Download ARM parameters
3. Validate with Azure Pricing Calculator
4. Plan deployment schedule
5. Execute deployment following Azure Local docs

---

**Version**: 0.14.50  
**Last Updated**: February 5, 2026  
**Compatibility**: Azure Local 2506+

Happy Configuring! 🎉
