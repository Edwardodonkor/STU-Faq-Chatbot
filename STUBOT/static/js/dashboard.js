// document.addEventListener('DOMContentLoaded', () => {
//   const contentArea = document.getElementById('contentArea');

  // Default view
  // contentArea.innerHTML = '<p>This is the home dashboard showing all data. (Static for now)</p>';

  // Navigation Handlers
  // document.getElementById('home').addEventListener('click', (e) => {
  //   e.preventDefault();
  //   contentArea.innerHTML = '<p>This is the home dashboard showing all data.</p>';
  // });

  // document.getElementById('logs').addEventListener('click', (e) => {
  //   e.preventDefault();
  //   contentArea.innerHTML = '<p>Here you will see logs of all questions asked by users.</p>';
  // });

  // document.getElementById('logout').addEventListener('click', (e) => {
  //   e.preventDefault();
  //   alert('Logging out...');
  //   window.location.href = 'admin-login.html'; // Or login page
//   });
// });


const contentArea = document.getElementById('contentArea');

// Chart data
let totalCount = 0;
let answeredCount = 0;
let unansweredCount = 0;

// Load charts and counts on home
function loadHome() {
  fetch('logs.json')
    .then(res => res.json())
    .then(data => {
      totalCount = data.length;
      answeredCount = data.filter(q => q.status === 'answered').length;
      unansweredCount = totalCount - answeredCount;

      document.getElementById('total').textContent = totalCount;
      document.getElementById('answered').textContent = answeredCount;
      document.getElementById('unanswered').textContent = unansweredCount;

      // Line Chart
      const ctxLine = document.getElementById('lineChart').getContext('2d');
      new Chart(ctxLine, {
        type: 'line',
        data: {
          labels: data.map((_, i) => `Q${i + 1}`),
          datasets: [
            {
              label: 'Answered',
              data: data.map(q => q.status === 'answered' ? 1 : 0),
              borderColor: '#198754',
              fill: false
            },
            {
              label: 'Unanswered',
              data: data.map(q => q.status === 'unanswered' ? 1 : 0),
              borderColor: '#dc3545',
              fill: false
            }
          ]
        },
        options: {
          responsive: true,
          scales: {
            y: { beginAtZero: true }
          }
        }
      });

      // Pie Chart
      const ctxPie = document.getElementById('pieChart').getContext('2d');
      new Chart(ctxPie, {
        type: 'pie',
        data: {
          labels: ['Answered', 'Unanswered'],
          datasets: [{
            data: [answeredCount, unansweredCount],
            backgroundColor: ['#198754', '#dc3545']
          }]
        }
      });

      // Calendar
      const calendarEl = document.getElementById('calendar');
      new FullCalendar.Calendar(calendarEl, {
        initialView: 'dayGridMonth',
        height: 300,
        events: data.map(q => ({
          title: q.status,
          start: q.timestamp
        }))
      }).render();
    });
}

// Navigation
window.addEventListener('DOMContentLoaded', () => {
  loadHome();

  document.getElementById('home').addEventListener('click', e => {
    e.preventDefault();
    loadHome();
  });

  document.getElementById('logs').addEventListener('click', e => {
    e.preventDefault();
    contentArea.innerHTML = '<p>Logs section coming soon...</p>';
  });

  document.getElementById('logout').addEventListener('click', e => {
    e.preventDefault();
    alert('Logging out...');
    window.location.href = 'admin-login.html';
  });
});
