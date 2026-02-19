<template>
  <div class="booking-container">
    <van-nav-bar title="理发店预约查询" :right-text="isOwner ? '退出登录' : '店长登录'" @click-right="handleLoginClick" />
    
    <!-- Announcement Bar -->
    <van-notice-bar
      v-if="todayAnnouncements"
      left-icon="volume-o"
      :text="todayAnnouncements"
      background="#ecf9ff"
      color="#1989fa"
    />

    <div class="calendar-section">
      <van-calendar
        :poppable="false"
        :show-confirm="false"
        :style="{ height: '350px' }"
        :min-date="minDate"
        :max-date="maxDate"
        @select="onDateSelect"
        color="#1989fa"
      />
    </div>

    <div class="schedule-section" v-if="selectedDate">
      <van-divider content-position="center">
        {{ formattedDate }} 预约情况
      </van-divider>

      <div v-if="isShopClosed" class="closed-message">
        <van-empty description="本日店休，请选择其他日期" />
      </div>

      <div v-else class="slots-grid">
        <div
          v-for="slot in timeSlots"
          :key="slot.time"
          class="time-slot"
          :class="slot.status"
          @click="handleSlotClick(slot)"
        >
          <div class="time">{{ slot.time }}</div>
          <div class="status">
            <template v-if="slot.status === 'available'">
              <span>可预约</span>
            </template>
            <template v-else-if="slot.status === 'booked'">
              <span v-if="!isOwner">已预约</span>
              <div v-else class="owner-info">
                <div>{{ slot.appointment.customerName }}</div>
                <div>{{ slot.appointment.service }}</div>
              </div>
            </template>
             <template v-else-if="slot.status === 'offline'">
              <span>{{ slot.reason || '暂停服务' }}</span>
            </template>
            <template v-else>
              <span>休息</span>
            </template>
          </div>
        </div>
      </div>
    </div>

    <!-- Booking Popup -->
    <van-popup
      v-model:show="showBookingPopup"
      position="bottom"
      round
      :style="{ height: '60%' }"
    >
      <div class="popup-content">
        <div class="popup-header">
          <h3>预约 {{ formattedDate }} {{ currentBookingSlot?.time }}</h3>
        </div>
        
        <van-form @submit="confirmBooking">
          <van-field name="service" label="选择服务">
            <template #input>
              <van-radio-group v-model="selectedServiceId">
                <van-radio 
                  v-for="service in services" 
                  :key="service.id" 
                  :name="service.id"
                  class="service-radio"
                >
                  {{ service.name }} ({{ service.duration }}分钟)
                </van-radio>
              </van-radio-group>
            </template>
          </van-field>
          
          <van-field
            v-model="customerName"
            name="customerName"
            label="姓名"
            placeholder="请输入您的姓名"
            :rules="[{ required: true, message: '请填写姓名' }]"
          />
          
          <van-field
            v-model="customerPhone"
            name="customerPhone"
            label="电话"
            placeholder="请输入您的电话号码"
            type="tel"
            :rules="[{ required: true, message: '请填写电话号码' }, { pattern: /^1[3-9]\d{9}$/, message: '手机号格式错误' }]"
          />

          <div style="margin: 16px;">
            <van-button round block type="primary" native-type="submit">
              确认预约
            </van-button>
          </div>
        </van-form>
      </div>
    </van-popup>

    <!-- Owner Login Dialog -->
    <van-dialog v-model:show="showLoginDialog" title="店长登录" show-cancel-button @confirm="handleLoginConfirm">
      <van-form>
        <van-field
          v-model="loginForm.username"
          name="username"
          label="账号"
          placeholder="请输入账号"
        />
        <van-field
          v-model="loginForm.password"
          type="password"
          name="password"
          label="密码"
          placeholder="请输入密码"
        />
      </van-form>
    </van-dialog>

    <!-- Owner Set Offline Dialog -->
    <van-dialog v-model:show="showOfflineDialog" title="设置不可预约" show-cancel-button @confirm="handleSetOffline">
      <van-field
        v-model="offlineReason"
        label="理由"
        placeholder="请输入不可预约理由"
      />
    </van-dialog>
    
    <!-- Owner View Detail Popup -->
    <van-popup v-model:show="showDetailPopup" round position="center" :style="{ width: '80%', padding: '20px' }">
      <div v-if="currentDetailSlot && currentDetailSlot.appointment">
         <h3>预约详情</h3>
         <p><strong>时间：</strong>{{ formattedDate }} {{ currentDetailSlot.time }}</p>
         <p><strong>姓名：</strong>{{ currentDetailSlot.appointment.customerName }}</p>
         <p><strong>电话：</strong>{{ currentDetailSlot.appointment.phoneNumber }}</p>
         <p><strong>服务：</strong>{{ currentDetailSlot.appointment.service }} ({{ currentDetailSlot.appointment.duration }}分钟)</p>
         <van-button block type="primary" @click="showDetailPopup = false">关闭</van-button>
      </div>
    </van-popup>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, reactive } from 'vue';
import dayjs from 'dayjs';
import isSameOrBefore from 'dayjs/plugin/isSameOrBefore';
import isSameOrAfter from 'dayjs/plugin/isSameOrAfter';
import { shopConfig, appointments as initialAppointments, closedDates, services } from '../data/schedule';
import { showToast, Dialog } from 'vant';

dayjs.extend(isSameOrBefore);
dayjs.extend(isSameOrAfter);

const minDate = new Date();
const maxDate = dayjs().add(shopConfig.maxDaysAdvance, 'day').toDate();
const selectedDate = ref(new Date());

// Local state
const localAppointments = ref([...initialAppointments]);
const unavailableSlots = ref([]); // Store owner-set offline slots: { date: 'YYYY-MM-DD', time: 'HH:mm', reason: '...' }
const isOwner = ref(false);

// Load from localStorage
onMounted(() => {
  const savedApps = localStorage.getItem('appointments');
  if (savedApps) {
    localAppointments.value = JSON.parse(savedApps);
  }
  const savedUnavailable = localStorage.getItem('unavailableSlots');
  if (savedUnavailable) {
    unavailableSlots.value = JSON.parse(savedUnavailable);
  }
  const savedOwner = localStorage.getItem('isOwner');
  if (savedOwner === 'true') {
    isOwner.value = true;
  }
});

const showBookingPopup = ref(false);
const showLoginDialog = ref(false);
const showOfflineDialog = ref(false);
const showDetailPopup = ref(false);
const currentBookingSlot = ref(null);
const currentDetailSlot = ref(null);
const selectedServiceId = ref(services[0].id);
const customerName = ref('');
const customerPhone = ref('');
const offlineReason = ref('');

const loginForm = reactive({
  username: '',
  password: ''
});

const formattedDate = computed(() => {
  return dayjs(selectedDate.value).format('YYYY-MM-DD');
});

const isShopClosed = computed(() => {
  return closedDates.includes(formattedDate.value);
});

// Compute announcements for today
const todayAnnouncements = computed(() => {
  const slots = unavailableSlots.value.filter(s => s.date === formattedDate.value);
  if (slots.length === 0) return '';
  
  // Group consecutive slots or just list reasons
  // Simple version: List unique reasons
  const reasons = [...new Set(slots.map(s => s.reason))];
  const timeRanges = slots.map(s => s.time).sort();
  
  if (reasons.length > 0) {
    return `温馨提示：${formattedDate.value} 部分时段因 ${reasons.join(', ')} 暂停服务，请选择其他时段。`;
  }
  return '';
});

const timeSlots = computed(() => {
  const slots = [];
  const startHour = parseInt(shopConfig.openTime.split(':')[0]);
  const endHour = parseInt(shopConfig.closeTime.split(':')[0]);
  const dateStr = formattedDate.value;
  const slotDuration = shopConfig.slotDuration || 30; // default 30 mins

  // Generate slots based on duration
  let current = dayjs(dateStr).hour(startHour).minute(0);
  const end = dayjs(dateStr).hour(endHour).minute(0);

  while (current.isBefore(end)) {
    const timeStr = current.format('HH:mm');
    const slotStart = current;
    const slotEnd = current.add(slotDuration, 'minute');
    
    // 1. Check if manually set offline by owner
    const offlineSlot = unavailableSlots.value.find(s => s.date === dateStr && s.time === timeStr);
    
    // 2. Check if booked
    // A slot is booked if any appointment overlaps with this slot
    const appointment = localAppointments.value.find(app => {
      if (app.date !== dateStr) return false;
      
      const appStart = dayjs(`${app.date} ${app.time}`);
      const appEnd = appStart.add(app.duration || 60, 'minute'); 

      // Check overlap
      return appStart.isBefore(slotEnd) && appEnd.isAfter(slotStart);
    });
    
    let status = 'available';
    let reason = '';
    
    if (offlineSlot) {
      status = 'offline';
      reason = offlineSlot.reason;
    } else if (appointment) {
      status = 'booked';
    } else if (dayjs(dateStr).isSame(dayjs(), 'day')) {
      if (slotStart.isBefore(dayjs())) {
        status = 'past'; 
      }
    }

    slots.push({ time: timeStr, status, appointment, reason });
    current = current.add(slotDuration, 'minute');
  }
  return slots;
});

const onDateSelect = (date) => {
  selectedDate.value = date;
};

const handleLoginClick = () => {
  if (isOwner.value) {
    Dialog.confirm({
      title: '确认退出',
      message: '确定要退出店长登录吗？',
    }).then(() => {
      isOwner.value = false;
      localStorage.removeItem('isOwner');
      showToast('已退出登录');
    }).catch(() => {});
  } else {
    showLoginDialog.value = true;
    loginForm.username = '18127313318'; // Pre-fill for convenience as requested default
    loginForm.password = '';
  }
};

const handleLoginConfirm = () => {
  if (loginForm.username === '18127313318' && loginForm.password === '123456') {
    isOwner.value = true;
    localStorage.setItem('isOwner', 'true');
    showToast('登录成功');
    showLoginDialog.value = false;
  } else {
    showToast('账号或密码错误');
    // Prevent dialog from closing? Vant dialog confirm closes by default. 
    // We might need to reopen or handle async close. 
    // For simplicity, let user try again.
  }
};

const handleSlotClick = (slot) => {
  if (isOwner.value) {
    // Owner interactions
    if (slot.status === 'available') {
      currentBookingSlot.value = slot;
      offlineReason.value = '';
      showOfflineDialog.value = true;
    } else if (slot.status === 'booked') {
      currentDetailSlot.value = slot;
      showDetailPopup.value = true;
    } else if (slot.status === 'offline') {
       Dialog.confirm({
        title: '取消限制',
        message: '确定要恢复该时段为可预约状态吗？',
      }).then(() => {
        // Remove from unavailableSlots
        unavailableSlots.value = unavailableSlots.value.filter(s => !(s.date === formattedDate.value && s.time === slot.time));
        localStorage.setItem('unavailableSlots', JSON.stringify(unavailableSlots.value));
        showToast('已恢复');
      });
    }
    return;
  }

  // Regular user interactions
  if (slot.status !== 'available') {
    if (slot.status === 'booked') showToast('该时段已预约');
    else if (slot.status === 'past') showToast('该时段已过期');
    else if (slot.status === 'offline') showToast(`该时段暂不开放: ${slot.reason}`);
    return;
  }
  currentBookingSlot.value = slot;
  showBookingPopup.value = true;
};

const handleSetOffline = () => {
  if (!offlineReason.value) {
    showToast('请输入理由');
    return;
  }
  unavailableSlots.value.push({
    date: formattedDate.value,
    time: currentBookingSlot.value.time,
    reason: offlineReason.value
  });
  localStorage.setItem('unavailableSlots', JSON.stringify(unavailableSlots.value));
  showToast('设置成功');
  showOfflineDialog.value = false;
};

const confirmBooking = () => {
  if (!currentBookingSlot.value || !selectedServiceId.value) return;

  const service = services.find(s => s.id === selectedServiceId.value);
  const newAppointment = {
    date: formattedDate.value,
    time: currentBookingSlot.value.time,
    status: 'booked',
    customerName: customerName.value,
    phoneNumber: customerPhone.value,
    service: service.name,
    duration: service.duration
  };

  localAppointments.value.push(newAppointment);
  
  // Save to localStorage
  localStorage.setItem('appointments', JSON.stringify(localAppointments.value));
  
  showToast('预约成功！');
  showBookingPopup.value = false;
  
  // Reset form
  customerName.value = '';
  customerPhone.value = '';
  selectedServiceId.value = services[0].id;
};
</script>

<style scoped>
.booking-container {
  padding-bottom: 50px;
}
.calendar-section {
  box-shadow: 0 2px 12px rgba(100, 101, 102, 0.08);
}
.slots-grid {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 10px;
  padding: 10px;
}
.time-slot {
  background: #fff;
  border: 1px solid #ebedf0;
  border-radius: 4px;
  padding: 8px 4px;
  text-align: center;
  cursor: pointer;
  transition: all 0.3s;
}
.time-slot.available {
  background-color: #f0f9eb;
  color: #67c23a;
  border-color: #c2e7b0;
}
.time-slot.booked {
  background-color: #fef0f0;
  color: #f56c6c; /* Red text */
  border-color: #fbc4c4;
}
/* Make the whole box redish for booked as requested */
.time-slot.booked {
  background-color: #ff4d4f;
  color: white;
  border-color: #ff4d4f;
}
.time-slot.offline {
  background-color: #f5f5f5;
  color: #999;
  border-color: #ddd;
}
.time-slot.past {
  background-color: #f5f7fa;
  color: #909399;
  border-color: #e4e7ed;
  cursor: not-allowed;
}
.time {
  font-size: 14px;
  font-weight: bold;
  margin-bottom: 4px;
}
.status {
  font-size: 12px;
}
.owner-info {
  font-size: 10px;
  line-height: 1.2;
}
.popup-content {
  padding: 16px;
}
.popup-header {
  text-align: center;
  margin-bottom: 20px;
}
.service-radio {
  margin-bottom: 8px;
}
</style>
