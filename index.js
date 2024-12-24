const { Client, GatewayIntentBits, EmbedBuilder } = require('discord.js');
const os = require('os');
const osu = require('os-utils');
const { exec } = require('child_process');
const config = require('./config.json');

const client = new Client({ intents: [GatewayIntentBits.Guilds] });

client.once('ready', () => {
  console.log(`Logged in as ${client.user.tag}`);
  sendSystemInfo();
  setInterval(sendSystemInfo, config.interval * 1000);
});

async function sendSystemInfo() {
  const channel = client.channels.cache.get(config.channelId);
  if (!channel) {
    console.error(`Channel with ID ${config.channelId} not found.`);
    return;
  }

  // fetch system stats and convert data to GB
  const cpuUsage = await new Promise((resolve) => osu.cpuUsage(resolve));
  const freeMem = os.freemem() / (1024 ** 3);
  const totalMem = os.totalmem() / (1024 ** 3);
  const uptime = os.uptime();
  const diskStats = await getDiskUsage();
  const cpuModel = os.cpus()[0].model;

  // format uptime data
  const uptimeHours = Math.floor(uptime / 3600);
  const uptimeMinutes = Math.floor((uptime % 3600) / 60);
  const uptimeSeconds = Math.floor(uptime % 60);

  const lastUpdated = new Date().toLocaleString();

  // fetch physical CPU core usages
  const cpuCoreUsage = await getPhysicalCpuCoreUsage();

  // create embed
  const embed = new EmbedBuilder()
    .setTitle('System Information 🖥️')
    .setColor(0x1E90FF)
    .addFields(
      { name: '💻 CPU Usage', value: `${(cpuUsage * 100).toFixed(2)}%`, inline: true },
      { name: '🧠 Memory Usage', value: `${(totalMem - freeMem).toFixed(2)} GB / ${totalMem.toFixed(2)} GB`, inline: true },
      { name: '💾 Disk Usage', value: `${diskStats.used.toFixed(2)} GB / ${diskStats.total.toFixed(2)} GB (${diskStats.percent}%)`, inline: true },
      { name: '⏱️ Uptime', value: `${uptimeHours}h ${uptimeMinutes}m ${uptimeSeconds}s`, inline: true },
      { name: '🖥️ OS', value: `${os.type()} ${os.release()} ${os.arch()}`, inline: true },
      { name: '🧑‍💻 CPU Model', value: `${cpuModel}`, inline: true },
      { name: '🧑‍💻 CPU Cores Usage', value: cpuCoreUsage.join('\n'), inline: false }
    )
    .setFooter({ text: `Last updated: ${lastUpdated}` });

  try {
    await channel.send({ embeds: [embed] });
    console.log('System information sent successfully.');
  } catch (error) {
    console.error('Failed to send system information:', error);
  }
}

// helper for disk usage
async function getDiskUsage() {
  return new Promise((resolve, reject) => {
    exec('wmic logicaldisk where "DeviceID=\\"C:\\"" get FreeSpace,Size', (error, stdout, stderr) => {
      if (error || stderr) {
        reject('Failed to get disk space using WMIC');
      }

      const lines = stdout.split('\n');
      const diskStats = lines[1].trim().split(/\s+/);
      const totalSpace = parseInt(diskStats[1]);
      const freeSpace = parseInt(diskStats[0]);
      const usedSpace = totalSpace - freeSpace;
      const usedGB = usedSpace / (1024 ** 3); // GB
      const totalGB = totalSpace / (1024 ** 3); // GB
      const percent = ((usedSpace / totalSpace) * 100).toFixed(2);

      resolve({
        used: usedGB,
        total: totalGB,
        percent
      });
    });
  });
}

// helper for fetching physical core usage while filtering logical cores
async function getPhysicalCpuCoreUsage() {
  return new Promise((resolve) => {
    const cpuUsages = [];
    const physicalCores = os.cpus().filter((core, index) => index % 2 === 0);

    let count = 0;
    physicalCores.forEach((core, index) => {
      osu.cpuUsage((cpuUsage) => {
        cpuUsages.push(`Core ${index + 1}: ${(cpuUsage * 100).toFixed(2)}%`);
        count++;
        if (count === physicalCores.length) {
          resolve(cpuUsages);
        }
      });
    });
  });
}

client.login(config.token);
