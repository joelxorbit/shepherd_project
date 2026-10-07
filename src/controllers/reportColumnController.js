const ReportColumn = require('../models/ReportColumn');

// Get all columns
exports.getColumns = async (req, res) => {
  try {
    let columns = await ReportColumn.find().sort({ order: 1 });
    
    if (columns.length === 0) {
      const defaultColumns = [
        { key: 'villageName', label: 'Village Name', order: 1, isDefault: true, inputType: 'text', options: '' },
        { key: 'issue', label: 'Issue', order: 2, isDefault: true, inputType: 'text', options: '' },
        { key: 'status', label: 'Status', order: 3, isDefault: true, inputType: 'select', options: 'Pending,In Progress,Resolved' }
      ];
      await ReportColumn.insertMany(defaultColumns);
      columns = await ReportColumn.find().sort({ order: 1 });
    }
    
    res.json(columns);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// Create a new column
exports.createColumn = async (req, res) => {
  try {
    const { key, label, order, inputType, options } = req.body;
    
    const existing = await ReportColumn.findOne({ key });
    if (existing) {
      return res.status(400).json({ message: 'Column key already exists' });
    }

    const column = new ReportColumn({ key, label, order, inputType, options });
    await column.save();
    res.status(201).json(column);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// Update a column
exports.updateColumn = async (req, res) => {
  try {
    const { label, order, inputType, options } = req.body;
    const column = await ReportColumn.findById(req.params.id);
    
    if (!column) {
      return res.status(404).json({ message: 'Column not found' });
    }

    if (label !== undefined) column.label = label;
    if (order !== undefined) column.order = order;
    if (inputType !== undefined) column.inputType = inputType;
    if (options !== undefined) column.options = options;

    await column.save();
    res.json(column);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// Delete a column
exports.deleteColumn = async (req, res) => {
  try {
    const column = await ReportColumn.findById(req.params.id);
    if (!column) {
      return res.status(404).json({ message: 'Column not found' });
    }
    
    await ReportColumn.findByIdAndDelete(req.params.id);
    res.json({ message: 'Column deleted' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};
