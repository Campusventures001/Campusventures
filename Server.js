require('dotenv').config();

const path = require('path');
const express = require('express');
const cors = require('cors');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const nodemailer = require('nodemailer');
const connectDatabase = require('./server/config/database');
const User = require('./server/models/User');
const Listing = require('./server/models/Listing');
const Inquiry = require('./server/models/Inquiry');
const Lead = require('./server/models/Lead');

const app = express();
const port = Number(process.env.PORT || 3000);
const jwtSecret = process.env.JWT_SECRET;

if (!jwtSecret) throw new Error('JWT_SECRET is missing. Add a strong value to .env.');
app.use(cors());
app.use(express.json({ limit: '100kb' }));

const publicUser = (user) => ({ id: user._id, email: user.email, name: user.name, role: user.role });
const createToken = (user) => jwt.sign({ sub: user._id.toString(), role: user.role }, jwtSecret, { expiresIn: '7d' });

async function requireAuth(req, res, next) {
  const token = req.headers.authorization?.replace(/^Bearer\s+/i, '');
  if (!token) return res.status(401).json({ message: 'Sign in is required.' });
  try { req.auth = jwt.verify(token, jwtSecret); next(); }
  catch { return res.status(401).json({ message: 'Your session has expired. Please sign in again.' }); }
}
function requireAdmin(req, res, next) {
  if (req.auth?.role !== 'admin') return res.status(403).json({ message: 'Administrator access is required.' });
  next();
}
async function seedAdmin() {
  const email = String(process.env.ADMIN_EMAIL || '').trim().toLowerCase();
  const password = String(process.env.ADMIN_PASSWORD || '');
  if (!email || !password) return;
  const user = await User.findOne({ email });
  if (user) { if (user.role !== 'admin') { user.role = 'admin'; await user.save(); } return; }
  await User.create({ email, passwordHash: await bcrypt.hash(password, 12), role: 'admin' });
}

app.get('/api/health', (_req, res) => res.json({ ok: true }));

app.post('/api/auth/register', async (req, res, next) => {
  try {
    const email = String(req.body.email || '').trim().toLowerCase();
    const password = String(req.body.password || '');
    if (!/^\S+@\S+\.\S+$/.test(email)) return res.status(400).json({ message: 'Enter a valid email address.' });
    if (password.length < 8) return res.status(400).json({ message: 'Password must contain at least 8 characters.' });
    if (await User.exists({ email })) return res.status(409).json({ message: 'An account with this email already exists. Please sign in.' });
    const user = await User.create({ email, passwordHash: await bcrypt.hash(password, 12) });
    return res.status(201).json({ token: createToken(user), user: publicUser(user) });
  } catch (error) { next(error); }
});

app.post('/api/auth/login', async (req, res, next) => {
  try {
    const email = String(req.body.email || '').trim().toLowerCase();
    const password = String(req.body.password || '');
    const user = await User.findOne({ email }).select('+passwordHash');
    if (!user || !(await bcrypt.compare(password, user.passwordHash))) return res.status(401).json({ message: 'Incorrect email or password.' });
    return res.json({ token: createToken(user), user: publicUser(user) });
  } catch (error) { next(error); }
});
app.post('/api/admin/login', async (req, res, next) => {
  try {
    const email = String(req.body.email || '').trim().toLowerCase();
    const password = String(req.body.password || '');
    const user = await User.findOne({ email }).select('+passwordHash');
    if (!user || user.role !== 'admin' || !(await bcrypt.compare(password, user.passwordHash))) return res.status(401).json({ message: 'Invalid administrator credentials.' });
    return res.json({ token: createToken(user), user: publicUser(user) });
  } catch (error) { next(error); }
});

app.get('/api/listings', async (_req, res, next) => {
  try { res.json(await Listing.find().sort({ createdAt: -1 }).lean()); }
  catch (error) { next(error); }
});

app.post('/api/listings', requireAuth, requireAdmin, async (req, res, next) => {
  try {
    const listing = await Listing.create({ ...req.body, createdBy: req.auth.sub });
    res.status(201).json(listing);
  } catch (error) { next(error); }
});

app.post('/api/inquiries', async (req, res, next) => {
  try {
    const inquiry = await Inquiry.create(req.body);
    res.status(201).json(inquiry);
  } catch (error) { next(error); }
});

app.use(express.static(path.join(__dirname, 'public')));
app.use((error, _req, res, _next) => {
  console.error(error);
  res.status(500).json({ message: 'The server could not complete your request.' });
});

const leadToEmail = String(process.env.LEAD_EMAIL_TO || 'campusventures001@gmail.com');
let mailTransporter;
function getMailTransporter() {
  const user = process.env.EMAIL_USER;
  const pass = process.env.EMAIL_PASS;
  if (!user || !pass) return null;
  if (!mailTransporter) mailTransporter = nodemailer.createTransport({ host: process.env.EMAIL_HOST || 'smtp.gmail.com', port: Number(process.env.EMAIL_PORT || 465), secure: true, auth: { user, pass } });
  return mailTransporter;
}
async function sendLeadEmail(lead, updated) {
  const transporter = getMailTransporter();
  if (!transporter) { console.log('Lead email skipped (EMAIL_USER/EMAIL_PASS not set in .env):', lead.email); return; }
  try {
    await transporter.sendMail({
      from: `"Campus Venture" <${process.env.EMAIL_USER}>`,
      to: leadToEmail,
      subject: `${updated ? 'Updated' : 'New'} Campus Venture lead — ${lead.name}`,
      text: ['Campus Venture lead', '', `Name: ${lead.name}`, `Phone: ${lead.phone}`, `Email: ${lead.email}`, `Interested in: ${lead.interest}`, `Source: ${lead.source}`, `Recorded: ${new Date(lead.createdAt || Date.now()).toLocaleString('en-IN')}`, '', 'Follow up with this lead.'].join('\n')
    });
    console.log(`Lead email sent to ${leadToEmail} for ${lead.email}`);
  } catch (error) { console.error('Lead email failed:', error.message); }
}

app.get('/api/leads', requireAuth, requireAdmin, async (_req, res, next) => {
  try { res.json(await Lead.find().sort({ updatedAt: -1 }).lean()); }
  catch (error) { next(error); }
});

app.post('/api/leads', async (req, res, next) => {
  try {
    const name = String(req.body.name || '').trim();
    const phone = String(req.body.phone || '').trim();
    const email = String(req.body.email || '').trim().toLowerCase();
    const interest = ['buy', 'sell', 'both'].includes(req.body.interest) ? req.body.interest : 'buy';
    if (!name) return res.status(400).json({ message: 'Enter your name.' });
    if (!/^[\d\s+\-()]{7,15}$/.test(phone)) return res.status(400).json({ message: 'Enter a valid phone number.' });
    if (!/^\S+@\S+\.\S+$/.test(email)) return res.status(400).json({ message: 'Enter a valid email address.' });

    const existing = await Lead.findOne({ $or: [{ email }, { phone }] });
    let lead;
    let updated = false;
    if (existing) {
      lead = await Lead.findByIdAndUpdate(existing._id, { name, email, phone, interest, source: req.body.source || 'website' }, { new: true, runValidators: true });
      updated = true;
    } else {
      lead = await Lead.create({ name, phone, email, interest, source: req.body.source || 'website' });
    }
    sendLeadEmail(lead, updated);
    res.status(updated ? 200 : 201).json({ lead, updated });
  } catch (error) { next(error); }
});

app.put('/api/listings/:id', requireAuth, requireAdmin, async (req, res, next) => {
  try {
    const editable = ['location', 'demand', 'plot', 'constructed', 'classUpTo', 'students', 'fee', 'board', 'state', 'extra'];
    const update = {};
    for (const key of editable) if (req.body[key] !== undefined) update[key] = req.body[key];
    const listing = await Listing.findByIdAndUpdate(req.params.id, update, { new: true, runValidators: true });
    if (!listing) return res.status(404).json({ message: 'Listing not found.' });
    res.json(listing);
  } catch (error) { next(error); }
});

app.delete('/api/listings/:id', requireAuth, requireAdmin, async (req, res, next) => {
  try {
    const listing = await Listing.findByIdAndDelete(req.params.id);
    if (!listing) return res.status(404).json({ message: 'Listing not found.' });
    res.json({ ok: true });
  } catch (error) { next(error); }
});

const NEW_LISTINGS = [
  { location: 'Coimbatore, Tamil Nadu (Engineering College)', demand: '₹265 Cr (Negotiable)', plot: '20.16 Acres', constructed: '35,000 Sqft + 4.6 Lakh Sqft RCC', classUpTo: 'PG & Ph.D', students: '1,284', board: 'AICTE / Anna University', state: 'Tamil Nadu', extra: 'AICTE approved, Anna University (Coimbatore) affiliated; Estd 2007; Hostel: 2 (Boys & Girls) with 1,000 capacity; Teaching & Non-Teaching Staff: 75; Transport: 15 Buses + 1 Car; Departments: AI & Data Science, Mechanical, ECE, CSE, IT, EEE, Management Studies, Science & Humanities; UG: BE CSE/ECE/EEE, B.Tech IT & AI-DS, BE Mechanical; PG: MBA, ME CSE, ME VLSI; Ph.D: CSE & ECE; MoUs with local industries for job training' },
  { location: 'Rasipuram, Namakkal District, Tamil Nadu (Vedha Vikas School)', demand: '₹45 Cr (Negotiable)', plot: '6 Acres', constructed: '2 Lakh Sqft', classUpTo: '10th', students: '500', board: 'CBSE + State Board', state: 'Tamil Nadu', extra: '72 Classrooms; 30,000 Sqft Shed; 11 Buses; RO System; Generator; 5 Labs; 1 Meeting Hall; Capacity 5,000' },
  { location: 'Kallakurichi District, Tamil Nadu (CBSE School)', demand: 'On request', plot: '', constructed: '', classUpTo: '', students: '', board: 'CBSE', state: 'Tamil Nadu', extra: 'Plot and constructed details on request' },
  { location: 'Morappur Block, Dharmapuri District, Tamil Nadu', demand: 'On request', plot: '6.55 Acres (4.05 + 2.50)', constructed: '', classUpTo: '12th (LKG–XII)', students: '3,800 (Matric 3,566 + CBSE 234)', board: 'Matric + CBSE', state: 'Tamil Nadu', extra: 'IVL Matric Hr. Sec. School (Estd 2010, IVL Educational & Charitable Trust); 156 Classrooms; 38 Vehicles; Teaching Staff 181; Non-Teaching Staff 126; Annual Income ₹19.55 Cr; Government Value ₹60.27 Cr; Market Value ₹128.70 Cr; Trust-owned land; English medium; NEET coaching for VI–XII; R.O. purified water; Huge library; Yoga, Karate, Skating, Archery, STEM & IIT labs' }
];

async function seedNewListings() {
  if (!NEW_LISTINGS.length) return;
  const admin = await User.findOne({ role: 'admin' });
  if (!admin) return;
  let added = 0;
  for (const item of NEW_LISTINGS) {
    const exists = await Listing.exists({ location: item.location, demand: item.demand });
    if (!exists) { await Listing.create({ ...item, createdBy: admin._id }); added++; }
  }
  if (added) console.log(`Seeded ${added} new listing(s) into the database.`);
}

async function startServer() {
  try {
    await connectDatabase();
    await seedAdmin();
    await seedNewListings();
  } catch (error) {
    console.error('MongoDB connection failed — starting without the database. The site will work, but listing/lead sync needs Atlas to be reachable:', error.message);
  }
  app.listen(port, () => console.log(`Campus Venture is running at http://localhost:${port}`));
}
startServer();
