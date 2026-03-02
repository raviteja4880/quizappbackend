const express = require("express");
const auth = require("../middleware/authMiddleware");
const { getStudentDashboard } = require("../controllers/dashboardController");

const router = express.Router();

router.get("/student", auth, getStudentDashboard);

module.exports = router;
