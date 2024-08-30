const {
  Client,
  GatewayIntentBits,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  StringSelectMenuBuilder,
  Events,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  InteractionType,
  EmbedBuilder,
} = require('discord.js');
const fs = require('fs');
const path = require('path');
const { TOKEN, CHANNEL_ID, ROLE_ID, ALLOWED_USER_IDS } = require('./config.js');

const CONFIG_PATH = path.resolve(__dirname, 'config.js');
const LOG_PATH = path.resolve(__dirname, 'log.txt');
const DAILY_LIMIT = 3; 
const DAILY_LOG_PATH = path.resolve(__dirname, 'daily_log.json');

let dailyLogs = {};

try {
  dailyLogs = JSON.parse(fs.readFileSync(DAILY_LOG_PATH, 'utf8'));
} catch (error) {
  dailyLogs = {};
}

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.DirectMessages,
  ],
});

client.once('ready', async () => {
  console.log('Smoke Cheats Geri Bildirim Botu aktif.');
  console.log('Bot mozzartcpp Tarafından Kodlanmıştır...');

  const channel = await client.channels.fetch(CHANNEL_ID);

  if (channel) {
    const button = new ButtonBuilder()
      .setCustomId('open_select_menu')
      .setLabel('Geri Bildirim')
      .setStyle(ButtonStyle.Primary);

    const row = new ActionRowBuilder().addComponents(button);

    const embed = new EmbedBuilder()
      .setColor('#0099ff')
      .setTitle('Geri Bildirim')
      .setDescription(
        'Selam! Aşağıdaki butondan bize öneri veya şikayetinizi iletebilirsiniz. SmokeCheats yetkililerimiz en kısa zamanda ilgilenecektir.'
      )
      .setFooter({
        text: 'Smoke Cheats Geri Bildirim Botu',
        iconURL: client.user.displayAvatarURL(),
      });

    await channel.send({
      embeds: [embed],
      components: [row],
    });

    console.log('Geri bildirim mesajı gönderildi.');
  } else {
    console.log('Kanal ID’si yanlış!');
  }
});

client.on(Events.InteractionCreate, async (interaction) => {
  if (interaction.isButton()) {
    if (interaction.customId === 'open_select_menu') {
      const selectMenu = new StringSelectMenuBuilder()
        .setCustomId('select_menu')
        .setPlaceholder('Bir seçenek seçin')
        .addOptions([
          {
            label: 'Şikayet',
            description: 'Şikayetinizi bildirin...',
            value: 'complaint',
          },
          {
            label: 'Öneri',
            description: 'Önerilerinizi Paylaşın...',
            value: 'suggestion',
          },
        ]);

      const row = new ActionRowBuilder().addComponents(selectMenu);

      await interaction.reply({
        content: 'Lütfen bir seçenek belirleyin:',
        components: [row],
        ephemeral: true,
      });
    }
  } else if (interaction.isStringSelectMenu()) {
    if (interaction.customId === 'select_menu') {
      const selectedOption = interaction.values[0];
      
      const modal = new ModalBuilder()
        .setCustomId('text_input_modal')
        .setTitle(selectedOption === 'complaint' ? 'Şikayet' : 'Öneri')
        .addComponents(
          new ActionRowBuilder().addComponents(
            new TextInputBuilder()
              .setCustomId('input_text')
              .setLabel(
                selectedOption === 'complaint'
                  ? 'Şikayetinizi buraya yazınız:'
                  : 'Önerinizi buraya yazınız:'
              )
              .setStyle(TextInputStyle.Paragraph)
              .setRequired(true)
          )
        );

      await interaction.showModal(modal);
    }
  } else if (
    interaction.type === InteractionType.ModalSubmit &&
    interaction.customId === 'text_input_modal'
  ) {
    const userInput = interaction.fields.getTextInputValue('input_text');
    const selectedOption = interaction.customData ? interaction.customData.selectedOption : 'unknown';
    const userName = interaction.user.tag;
    const userId = interaction.user.id;

    const today = new Date().toISOString().split('T')[0]; 
    if (!dailyLogs[userId]) {
      dailyLogs[userId] = {};
    }
    if (!dailyLogs[userId][today]) {
      dailyLogs[userId][today] = 0;
    }

    if (dailyLogs[userId][today] >= DAILY_LIMIT) {
      await interaction.reply({
        content: `Günlük geri bildirim limitinize ulaştınız. Lütfen yarına kadar bekleyin.`,
        ephemeral: true,
      });
      return;
    }

    dailyLogs[userId][today]++;
    fs.writeFileSync(DAILY_LOG_PATH, JSON.stringify(dailyLogs, null, 2));

   
    fs.appendFileSync(LOG_PATH, `${new Date().toISOString()} - ${userName} (${userId}): ${userInput}\n`);

    let TARGET_USER_NAMES = require(CONFIG_PATH).TARGET_USER_NAMES;
    if (!TARGET_USER_NAMES[userName]) {
      TARGET_USER_NAMES[userName] = userId;
      fs.writeFileSync(CONFIG_PATH, `module.exports = ${JSON.stringify({ TOKEN, CHANNEL_ID, ROLE_ID, ALLOWED_USER_IDS, TARGET_USER_NAMES }, null, 2)};`);
    }

    await interaction.reply({
      content: `${selectedOption === 'complaint' ? 'Şikayet' : 'Öneri'} gönderildi. Teşekkür ederiz, ${userName}!`,
      ephemeral: true,
    });

    const guild = interaction.guild;

    if (guild) {
      const role = guild.roles.cache.get(ROLE_ID);

      if (role) {
        role.members.forEach((member) => {
          if (member.user.bot) return;
          
          member
            .send({
              embeds: [
                new EmbedBuilder()
                  .setColor('#0099ff')
                  .setTitle(`Yeni Bir ${selectedOption === 'complaint' ? 'Şikayet' : 'Öneri'}`)
                  .setDescription(
                    `Merhaba ${member.user.username},\n\nBir ${selectedOption === 'complaint' ? 'Şikayet' : 'Öneri'} alındı:\n\n` +
                    `Gönderen: ${userName} (ID: ${userId})\n\n` +
                    `İçerik:\n"${userInput}"\n\n` +
                    'Teşekkürler!'
                  )
                  .setFooter({
                    text: 'Smoke Cheats Geri Bildirim Botu',
                    iconURL: client.user.displayAvatarURL(),
                  })
              ],
            })
            .catch((error) => console.log(`Mesaj gönderilemedi: ${error}`));
        });
      } else {
        console.log('Rol bulunamadı. Rol ID’nizi kontrol edin.');
      }
    } else {
      console.log('Sunucu bilgileri alınamadı.');
    }
  }
});

client.on(Events.MessageCreate, async (message) => {
  if (message.author.bot || !message.channel.isDMBased()) return;

  if (!ALLOWED_USER_IDS.includes(message.author.id)) {
    await message.reply('Bu komutu kullanma izniniz yok.');
    return;
  }

  if (message.content.startsWith('.mesaj ')) {
    const args = message.content.slice(7).trim().split(/ +/);
    const username = args.shift();
    const userMessage = args.join(' ');

    let TARGET_USER_NAMES = require(CONFIG_PATH).TARGET_USER_NAMES;
    if (!TARGET_USER_NAMES[username]) {
      await message.reply(`"${username}" adında bir kullanıcı bulunamadı.`);
      return;
    }

    const userId = TARGET_USER_NAMES[username];
    const user = await client.users.fetch(userId);

    if (user) {
      try {
        await user.send(userMessage);
        await message.reply(`Mesaj başarıyla ${username} adlı kullanıcıya gönderildi.`);

        const feedbackEmbed = new EmbedBuilder()
          .setColor('#0099ff')
          .setTitle('Yeni Bir Mesaj Gönderildi')
          .setDescription(
            `Gönderen: ${message.author.tag}\n\n` +
            `Mesaj:\n"${userMessage}"`
          )
          .setFooter({
            text: 'Smoke Cheats Geri Bildirim Botu',
            iconURL: client.user.displayAvatarURL(),
          });

        const guild = client.guilds.cache.first();
        const role = guild.roles.cache.get(ROLE_ID);
        if (role) {
          role.members.forEach(async (roleMember) => {
            if (!roleMember.user.bot) {
              try {
                await roleMember.send({ embeds: [feedbackEmbed] });
              } catch (error) {
                console.error(`Mesaj gönderilemedi ${roleMember.user.tag}: ${error.message}`);
              }
            }
          });
        } else {
          console.log('Rol bulunamadı. Rol ID’nizi kontrol edin.');
        }
      } catch (error) {
        console.error(`Mesaj gönderme hatası: ${error.message}`);
      }
    } else {
      await message.reply(`Kullanıcı ID "${userId}" ile eşleşen bir kullanıcı bulunamadı.`);
    }
  }
});

client.login(TOKEN);
