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
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue';
import dayjs from 'dayjs';
import { shopConfig, appointments, closedDates } from '../data/schedule';
import { showToast } from 'vant';

const minDate = new Date();
const maxDate = dayjs().add(shopConfig.maxDaysAdvance, 'day').toDate();
const selectedDate = ref(new Date());

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

  for (let h = startHour; h < endHour; h++) {
    const time = `${h.toString().padStart(2, '0')}:00`;
    
    // Check if booked
    const isBooked = appointments.some(app => app.date === dateStr && app.time === time);
    
    let status = 'available';
    if (isBooked) {
      status = 'booked';
    }

    // Check if past time (only for today)
    if (dayjs(dateStr).isSame(dayjs(), 'day')) {
      const currentHour = dayjs().hour();
      if (h <= currentHour) {
        status = 'past'; // Past time slots today
      }
    }

    slots.push({ time, status });
  }
  return slots;
});

const onDateSelect = (date) => {
  selectedDate.value = date;
  showToast(`已选择: ${dayjs(date).format('MM-DD')}`);
};
</script>

<style scoped>
.booking-container {
  padding-bottom: 20px;
  background-color: #f7f8fa;
  min-height: 100vh;
}

.calendar-section {
  margin-bottom: 10px;
}

.schedule-section {
  padding: 0 16px;
}

.slots-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 10px;
}

.time-slot {
  background: white;
  padding: 10px;
  border-radius: 8px;
  text-align: center;
  border: 1px solid #ebedf0;
}

.time-slot .time {
  font-size: 16px;
  font-weight: bold;
  color: #323233;
}

.time-slot .status {
  font-size: 12px;
  margin-top: 4px;
}

.time-slot.available {
  border-color: #1989fa;
  color: #1989fa;
  background-color: #f0f9ff;
}

.time-slot.booked {
  border-color: #ee0a24;
  color: #ee0a24;
  background-color: #fff0f1;
  opacity: 0.8;
}

.time-slot.past {
  border-color: #ebedf0;
  color: #969799;
  background-color: #f7f8fa;
}

.closed-message {
  padding: 20px;
  text-align: center;
}
</style>
