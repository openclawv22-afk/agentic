const API_BASE_URL = 'http://localhost:3000/api';

const landingPanel = document.getElementById('landing');
const authPanel = document.getElementById('auth');
const dashboardPanel = document.getElementById('dashboard');

const signupBtn = document.getElementById('signupBtn');
const contactBtn = document.getElementById('contactBtn');
const contactDialog = document.getElementById('contactDialog');
const closeContact = document.getElementById('closeContact');
const contactForm = document.getElementById('contactForm');

const googleAuthBtn = document.getElementById('googleAuthBtn');
const phoneAuthForm = document.getElementById('phoneAuthForm');
const sendOtpBtn = document.getElementById('sendOtpBtn');
const phoneNumberInput = document.getElementById('phoneNumber');
const otpCodeInput = document.getElementById('otpCode');
const verifyOtpBtn = document.getElementById('verifyOtpBtn');
const otpStatus = document.getElementById('otpStatus');
const dashboardContent = document.querySelector('.dashboard-content');

function showPanel(panel) {
  [landingPanel, authPanel, dashboardPanel].forEach((p) => p.classList.remove('active'));
  panel.classList.add('active');
}

function getToken() {
  return localStorage.getItem('authToken');
}

function setToken(token) {
  localStorage.setItem('authToken', token);
}

async function apiRequest(path, options = {}, includeAuth = false) {
  const headers = {
    'Content-Type': 'application/json',
    ...(options.headers || {})
  };

  if (includeAuth && getToken()) {
    headers.Authorization = `Bearer ${getToken()}`;
  }

  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...options,
    headers
  });

  const payload = await response.json();

  if (!response.ok) {
    throw new Error(payload.error || 'Request failed');
  }

  return payload;
}

async function renderDashboardData() {
  try {
    const [profile, bookings, properties, transactions] = await Promise.all([
      apiRequest('/me', {}, true),
      apiRequest('/bookings', {}, true),
      apiRequest('/properties', {}, true),
      apiRequest('/transactions', {}, true)
    ]);

    dashboardContent.innerHTML = `
      <h2>Welcome back, ${profile.full_name}!</h2>
      <p><strong>Email:</strong> ${profile.email} | <strong>Phone:</strong> ${profile.phone || '-'}</p>
      <ul>
        <li>Bookings: ${bookings.length}</li>
        <li>Properties: ${properties.length}</li>
        <li>Payments: ${transactions.length}</li>
      </ul>
    `;
  } catch (error) {
    dashboardContent.innerHTML = `<p class="error">Failed to load dashboard data: ${error.message}</p>`;
  }
}

signupBtn.addEventListener('click', () => showPanel(authPanel));

contactBtn.addEventListener('click', () => contactDialog.showModal());
closeContact.addEventListener('click', () => contactDialog.close());

contactForm.addEventListener('submit', async (event) => {
  event.preventDefault();
  const formData = new FormData(contactForm);
  const services = [...contactForm.querySelectorAll('input[name="services"]:checked')].map((item) => item.value);

  if (!services.length) {
    alert('Please select at least one service.');
    return;
  }

  const payload = {
    name: formData.get('name'),
    email: formData.get('email'),
    phone: formData.get('phone'),
    property: formData.get('property'),
    tentativeDate: formData.get('tentativeDate'),
    tentativeAmount: Number(formData.get('tentativeAmount')),
    services
  };

  try {
    await apiRequest('/inquiries', {
      method: 'POST',
      body: JSON.stringify(payload)
    });
    alert('Thank you! Your inquiry has been submitted.');
    contactDialog.close();
    contactForm.reset();
  } catch (error) {
    alert(`Failed to submit inquiry: ${error.message}`);
  }
});

googleAuthBtn.addEventListener('click', async () => {
  try {
    await apiRequest('/auth/google/start');
  } catch (error) {
    otpStatus.textContent = `Google sign-in unavailable: ${error.message}`;
  }
});

sendOtpBtn.addEventListener('click', async () => {
  const phone = phoneNumberInput.value.trim();

  if (!phone) {
    otpStatus.textContent = 'Enter a phone number first.';
    return;
  }

  try {
    const data = await apiRequest('/auth/otp/send', {
      method: 'POST',
      body: JSON.stringify({ phone })
    });

    otpCodeInput.disabled = false;
    verifyOtpBtn.disabled = false;
    otpStatus.textContent = `${data.message}. (Dev OTP: ${data.devOtp})`;
  } catch (error) {
    otpStatus.textContent = `Failed to send OTP: ${error.message}`;
  }
});

phoneAuthForm.addEventListener('submit', async (event) => {
  event.preventDefault();

  try {
    const data = await apiRequest('/auth/otp/verify', {
      method: 'POST',
      body: JSON.stringify({
        phone: phoneNumberInput.value.trim(),
        otp: otpCodeInput.value.trim()
      })
    });

    setToken(data.token);
    otpStatus.textContent = data.message;
    showPanel(dashboardPanel);
    renderDashboardData();
  } catch (error) {
    otpStatus.textContent = `Login failed: ${error.message}`;
  }
});
