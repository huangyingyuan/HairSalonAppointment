<template>
  <div class="booking-container">
    <van-nav-bar title="理发店预约查询" />

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
            <span v-if="slot.status === 'available'">可预约</span>
            <span v-else-if="slot.status === 'booked'">已预约</span>
            <span v-else>休息</span>
          </div>
        </div>
      </div>
    </div>

    <!-- Booking Popup -->
    <van-popup
      v-model:show="showBookingPopup"
      position="bottom"
      round
      :style="{ height: '50%' }"
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

          <div style="margin: 16px;">
            <van-button round block type="primary" native-type="submit">
              确认预约
            </van-button>
          </div>
        </van-form>
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
import { showToast } from 'vant';

dayjs.extend(isSameOrBefore);
dayjs.extend(isSameOrAfter);

const minDate = new Date();
const maxDate = dayjs().add(shopConfig.maxDaysAdvance, 'day').toDate();
const selectedDate = ref(new Date());

// Local state for appointments to support new bookings
const localAppointments = ref([...initialAppointments]);

// Load from localStorage if available
onMounted(() => {
  const saved = localStorage.getItem('appointments');
  if (saved) {
    localAppointments.value = JSON.parse(saved);
  }
});

const showBookingPopup = ref(false);
const currentBookingSlot = ref(null);
const selectedServiceId = ref(services[0].id);
const customerName = ref('');

const formattedDate = computed(() => {
  return dayjs(selectedDate.value).format('YYYY-MM-DD');
});

const isShopClosed = computed(() => {
  return closedDates.includes(formattedDate.value);
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
    
    // Check if booked
    // A slot is booked if any appointment overlaps with this slot
    const isBooked = localAppointments.value.some(app => {
      if (app.date !== dateStr) return false;
      
      const appStart = dayjs(`${app.date} ${app.time}`);
      const appEnd = appStart.add(app.duration || 60, 'minute'); // Default 60 if not set

      // Check overlap: (StartA < EndB) and (EndA > StartB)
      return appStart.isBefore(slotEnd) && appEnd.isAfter(slotStart);
    });
    
    let status = 'available';
    if (isBooked) {
      status = 'booked';
    }

    // Check if past time (only for today)
    if (dayjs(dateStr).isSame(dayjs(), 'day')) {
      if (slotStart.isBefore(dayjs())) {
        status = 'past'; 
      }
    }

    slots.push({ time: timeStr, status });
    current = current.add(slotDuration, 'minute');
  }
  return slots;
});

const onDateSelect = (date) => {
  selectedDate.value = date;
  showToast(`已选择: ${dayjs(date).format('MM-DD')}`);
};

const handleSlotClick = (slot) => {
  if (slot.status !== 'available') {
    if (slot.status === 'booked') showToast('该时段已预约');
    else if (slot.status === 'past') showToast('该时段已过期');
    return;
  }
  currentBookingSlot.value = slot;
  showBookingPopup.value = true;
};

const confirmBooking = () => {
  if (!currentBookingSlot.value || !selectedServiceId.value) return;

  const service = services.find(s => s.id === selectedServiceId.value);
  const newAppointment = {
    date: formattedDate.value,
    time: currentBookingSlot.value.time,
    status: 'booked',
    customerName: customerName.value,
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
