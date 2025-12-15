# Quick Start Guide - Azure Local Wizard v0.1.0

## 🚀 New in Version 0.1.0

### Header Actions (Top Right)
- **📁 Import Config** - Load a previously saved configuration
- **💾 Export Config** - Save your current configuration as JSON
- **🔢 CIDR Calculator** - Calculate subnet details
- **💰 Cost Estimate** - Get rough monthly cost estimates

### Before You Start
- **📋 View Prerequisites** - Blue button shows hardware/network/Azure requirements

### During Configuration
- **Compare Options** buttons - Available on Storage, Outbound, and Arc Gateway steps
- **Auto-Save** - Progress automatically saved to your browser
- **Real-time Validation** - Instant feedback on all inputs

### After Configuration
- **Resume Session** - Return anytime and pick up where you left off
- **What's New** - Click link in header to see all new features

---

## 📖 Quick Tips

### Saving Your Work
Your progress is **automatically saved** after every change. No manual save needed!

### Sharing Configurations
1. Click **Export Config**
2. Share the JSON file with your team
3. They click **Import Config** to load it

### Getting Help
- Look for **?** icons (coming soon in full release)
- Click **Compare Options** on key decisions
- Click **View Prerequisites** before starting
- Check **What's New** for feature overview

### Using the Calculator
1. Click **CIDR Calculator**
2. Enter IP/CIDR (e.g., 192.168.1.0/24)
3. See network, broadcast, usable hosts

### Estimating Costs
1. Configure your nodes and Arc Gateway
2. Click **Cost Estimate**
3. View monthly breakdown
4. **Note**: Estimates are rough, use Azure Pricing Calculator for accuracy

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

## 🔑 Keyboard Shortcuts

- **Tab** - Navigate between fields
- **Enter** - Select focused option
- **Escape** - Close modals (when open)

---

## 💡 Pro Tips

### Avoid IP Conflicts
Use the CIDR Calculator to verify subnets don't overlap.

### Plan for Growth
Size your infrastructure IP pool with extra capacity.

### Document Everything
Export your config regularly - it includes all your decisions.

### Compare Before Deciding
Use "Compare Options" buttons to understand trade-offs.

### Test Imports
After exporting, test importing on a fresh session to verify.

### Save Milestones
Export config at major decision points (before and after changes).

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

## 📚 Documentation

- **README.md** - Full documentation
- **IMPLEMENTATION_SUMMARY.md** - What's new in v0.1.0
- **EXPORT_FORMATS.md** - Export format details
- **FRAMEWORK_MIGRATION.md** - Future migration path
- **tests.html** - Unit test suite

---

## ⚡ Quick Actions

| Action | Location | Shortcut |
|--------|----------|----------|
| Export Config | Header | Top-right button |
| Import Config | Header | Top-right button |
| CIDR Calculator | Header | Blue button |
| Cost Estimate | Header | Green button |
| Prerequisites | Above wizard | Blue button |
| Compare Options | Step headers | Blue button |
| What's New | Header | Link below title |

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
- **Unit Tests** - Open tests.html to verify functionality
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

**Version**: 0.1.0  
**Last Updated**: December 15, 2025  
**Compatibility**: Azure Local 2506+

Happy Configuring! 🎉
