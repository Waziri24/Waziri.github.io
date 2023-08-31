import DerivAPIBasic from 'https://cdn.skypack.dev/@deriv/deriv-api/dist/DerivAPIBasic';

// Replace these with your actual WebSocket connection setup
const app_id = 36907;
const connection = new WebSocket(`wss://ws.derivws.com/websockets/v3?app_id=${app_id}`);
const api = new DerivAPIBasic({ connection });

const ticks_history_request = {
  ticks_history: 'JD50', // Default value
  adjust_start_time: 1,
  count: 119,
  end: 'latest',
  start: 1,
  style: 'ticks',
};

const priceList = document.getElementById('price-list');
const riseCountElement = document.getElementById('rise-count');
const fallCountElement = document.getElementById('fall-count');
const risePercentageElement = document.getElementById('rise-percentage');
const fallPercentageElement = document.getElementById('fall-percentage');

let riseCount = 0;
let fallCount = 0;
let trend = 'none';

const updateTrend = (currentPrice, prevPrice) => {
  if (currentPrice > prevPrice) {
    trend = 'rise';
  } else if (currentPrice < prevPrice) {
    trend = 'fall';
  }
};

const updateCountsAndPercentages = () => {
  const listItems = priceList.getElementsByTagName('li');
  const totalCount = listItems.length;
  riseCount = 0;
  fallCount = 0;
  trend = 'none'; // Reset the trend before calculations

  // Start from the second item since we're comparing with the previous one
  for (let i = 1; i < totalCount; i++) {
    const currentPrice = parseFloat(listItems[i].textContent);
    const prevPrice = parseFloat(listItems[i - 1].textContent);

    // Update the trend based on the current tick
    updateTrend(currentPrice, prevPrice);

    if (trend === 'rise') {
      riseCount++;
    } else if (trend === 'fall') {
      fallCount++;
    }
  }

  const totalRiseFallCount = riseCount + fallCount;
  const risePercentage = parseFloat((riseCount / totalRiseFallCount * 100).toFixed(1));
  const fallPercentage = parseFloat((fallCount / totalRiseFallCount * 100).toFixed(1));

  riseCountElement.textContent = `Rise Count: ${riseCount}`;
  fallCountElement.textContent = `Fall Count: ${fallCount}`;
  risePercentageElement.textContent = `Rise Percentage: ${risePercentage.toFixed(1)}%`;
  fallPercentageElement.textContent = `Fall Percentage: ${fallPercentage.toFixed(1)}%`;

  // Update Plotly chart
  updatePlotlyChart();
};


const updatePlotlyChart = () => {
  const labels = ['Rise', 'Fall'];
  const values = [riseCount, fallCount];

  const data = [{
    type: 'bar',
    x: labels,
    y: values,
    marker: {
      color: ['#5aa8ed', '#ed7c5a'] // Set colors for rise and fall bars
    },
    text: [`${risePercentageElement.textContent}`, `${fallPercentageElement.textContent}`], // Display percentages on the bars
    textposition: 'auto', // Position of the annotation
  }];

  const layout = {
    title: '',
    xaxis: { title: 'Trend' },
    yaxis: { title: 'Count' },
    annotations: [
      {
        x: 'Rise',
        y: riseCount,
        text: ``,
        showarrow: false,
      },
      {
        x: 'Fall',
        y: fallCount,
        text: ``,
        showarrow: false,
      },
    ],
  };

  Plotly.newPlot('plotly-chart', data, layout);
};

  

const ticksHistoryResponse = async (res) => {
  const data = JSON.parse(res.data);
  if (data.error !== undefined) {
    console.log('Error : ', data.error.message);
    connection.removeEventListener('message', ticksHistoryResponse, false);
    await api.disconnect();
  }
  if (data.msg_type === 'history') {
    const historyPrices = data.history.prices;
    for (const price of historyPrices) {
      const listItem = document.createElement('li');
      listItem.textContent = price;
      priceList.appendChild(listItem);
    }
    // Update the counts and percentages after adding history prices
    updateCountsAndPercentages();
  }
  connection.removeEventListener('message', ticksHistoryResponse, false);
};

const ticksResponse = async (res) => {
  const data = JSON.parse(res.data);
  if (data.error !== undefined) {
    console.log('Error : ', data.error.message);
    connection.removeEventListener('message', ticksResponse, false);
    await tickSubscriber().unsubscribe();
    await api.disconnect();
  }
  if (data.msg_type === 'tick') {
    const spotPrice = data.tick.quote;

    const listItem = document.createElement('li');
    listItem.textContent = spotPrice;
    priceList.appendChild(listItem);

    if (priceList.children.length > 119) {
      priceList.removeChild(priceList.children[0]);
    }

    priceList.scrollTop = priceList.scrollHeight;

    // Update the trend and counts/percentages after adding a new tick
    updateTrend(parseFloat(spotPrice), parseFloat(priceList.lastChild.previousSibling.textContent));
    updateCountsAndPercentages();
  }
};

const tickSubscriber = () => api.subscribe({
  ticks_history: ticks_history_request.ticks_history,
  adjust_start_time: 1,
  count: 119,
  end: 'latest',
  start: 1,
  style: 'ticks',
  subscribe: 1,
}).catch(error => {
  console.log('Subscription Error: ', error);
});

const getTicksHistory = async () => {
  connection.addEventListener('message', ticksHistoryResponse);
  await api.ticksHistory(ticks_history_request);
};

const startStopButton = document.querySelector('#start-stop-button');
let isRunning = false;

startStopButton.addEventListener('click', async () => {
  if (!isRunning) {
    isRunning = true;
    startStopButton.textContent = 'Stop';
    await getTicksHistory();
    connection.addEventListener('message', ticksResponse);
    await tickSubscriber();
  } else {
    isRunning = false;
    startStopButton.textContent = 'Start';
    connection.removeEventListener('message', ticksResponse, false);
    await tickSubscriber().unsubscribe();
    await api.disconnect();
  }
});

// Event listener for ticks history select
const ticksHistorySelect = document.getElementById('ticks-history-select');
ticksHistorySelect.addEventListener('change', () => {
  ticks_history_request.ticks_history = ticksHistorySelect.value;
});

// Call initially to create the chart
updatePlotlyChart();