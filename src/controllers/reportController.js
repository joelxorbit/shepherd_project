const Report = require('../models/Report');
const xlsx = require('xlsx');
const fs = require('fs');

exports.getReports = async (req, res) => {
  try {
    const reports = await Report.find().sort({ createdAt: -1 });
    res.json(reports);
  } catch (error) {
    res.status(500).json({ error: true, message: error.message });
  }
};

exports.addReport = async (req, res) => {
  try {
    const { villageName, issue, status } = req.body;
    
    if (!villageName || !issue || !status) {
      return res.status(400).json({ error: true, message: 'All fields are required' });
    }

    const report = new Report({ villageName, issue, status });
    await report.save();
    
    res.status(201).json({ success: true, report });
  } catch (error) {
    res.status(500).json({ error: true, message: error.message });
  }
};

exports.importExcel = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: true, message: 'No file uploaded' });
    }

    const workbook = xlsx.readFile(req.file.path);
    const sheetName = workbook.SheetNames[0];
    const data = xlsx.utils.sheet_to_json(workbook.Sheets[sheetName]);

    if (!data || data.length === 0) {
      return res.status(400).json({ error: true, message: 'No data found in the Excel file' });
    }

    // Try to handle variations of column names, e.g., 'Village Name', 'villageName', 'village_name'
    const formattedData = data.map(item => {
      // Find keys case-insensitively or matching known patterns
      const keys = Object.keys(item);
      let villageName = '';
      let issue = '';
      let status = '';

      keys.forEach(k => {
        const lowerK = k.toLowerCase().replace(/[^a-z]/g, '');
        if (lowerK.includes('village')) villageName = item[k];
        if (lowerK.includes('issue')) issue = item[k];
        if (lowerK.includes('status')) status = item[k];
      });

      return {
        villageName: villageName || item['Village Name'] || item['villageName'] || 'Unknown',
        issue: issue || item['Issue'] || item['issue'] || 'Unknown',
        status: status || item['Status'] || item['status'] || 'Pending'
      };
    });

    await Report.insertMany(formattedData);

    // Clean up uploaded file
    fs.unlinkSync(req.file.path);

    res.json({ success: true, count: formattedData.length, message: 'Data imported successfully' });
  } catch (error) {
    if (req.file && fs.existsSync(req.file.path)) {
      fs.unlinkSync(req.file.path);
    }
    res.status(500).json({ error: true, message: error.message });
  }
};

exports.updateReport = async (req, res) => {
  try {
    const { id } = req.params;
    const { villageName, issue, status } = req.body;

    if (!villageName || !issue || !status) {
      return res.status(400).json({ error: true, message: 'All fields are required' });
    }

    const updatedReport = await Report.findByIdAndUpdate(
      id,
      { villageName, issue, status },
      { new: true }
    );

    if (!updatedReport) {
      return res.status(404).json({ error: true, message: 'Report not found' });
    }

    res.json({ success: true, report: updatedReport });
  } catch (error) {
    res.status(500).json({ error: true, message: error.message });
  }
};

exports.deleteReport = async (req, res) => {
  try {
    const { id } = req.params;
    const deletedReport = await Report.findByIdAndDelete(id);

    if (!deletedReport) {
      return res.status(404).json({ error: true, message: 'Report not found' });
    }

    res.json({ success: true, message: 'Report deleted successfully' });
  } catch (error) {
    res.status(500).json({ error: true, message: error.message });
  }
};
