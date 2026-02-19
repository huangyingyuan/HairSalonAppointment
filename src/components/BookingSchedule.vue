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
        <span style="font-size: 12px; color: #999; margin-left: 5px;">
          <template v-if="isSyncing">(同步中...)</template>
          <template v-else-if="lastSyncTime">(上次更新: {{ lastSyncTime }})</template>
        </span>
      </van-divider>

      <div v-if="isShopClosed" class="closed-message">
        <van-empty description="本日店休，请选择其他日期" />
      </div>

      <div v-if="isOwner" class="batch-controls" style="padding: 10px;">
        <van-button 
            v-if="!isBatchMode" 
            type="primary" 
            size="small" 
            block 
            @click="isBatchMode = true"
        >
            批量设置/取消休息
        </van-button>
        <div v-else style="display: flex; gap: 10px;">
            <van-button 
                type="default" 
                size="small" 
                style="flex: 1;" 
                @click="cancelBatchMode"
            >
                退出
            </van-button>
            <van-button 
                :type="isBatchCancelMode ? 'danger' : 'primary'" 
                size="small" 
                style="flex: 1;" 
                @click="finishBatchMode"
                :disabled="batchSelectedSlots.length === 0"
            >
                {{ isBatchCancelMode ? `批量取消 (${batchSelectedSlots.length})` : `批量设置 (${batchSelectedSlots.length})` }}
            </van-button>
        </div>
      </div>

      <div class="slots-grid">
        <div
          v-for="slot in timeSlots"
          :key="slot.time"
          class="time-slot"
          :class="[slot.status, { 'batch-selected': isBatchMode && batchSelectedSlots.includes(slot.time) }]"
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

    <!-- Owner Logout Dialog -->
    <van-dialog v-model:show="showLogoutDialog" title="确认退出" show-cancel-button @confirm="handleLogoutConfirm">
      <div style="text-align: center; padding: 20px;">
        确定要退出店长登录吗？
      </div>
    </van-dialog>

    <!-- Owner Set Offline Dialog -->
    <van-dialog v-model:show="showOfflineDialog" title="设置休息时间" show-cancel-button @confirm="handleSetOffline">
      <van-form>
        <van-field
          v-model="offlineStartTime"
          type="time"
          label="开始时间"
          placeholder="选择开始时间"
        />
        <van-field
          v-model="offlineEndTime"
          type="time"
          label="结束时间"
          placeholder="选择结束时间"
        />
        <van-field
          v-model="offlineReason"
          label="理由"
          placeholder="请输入休息理由"
        />
      </van-form>
    </van-dialog>
    
    <!-- Batch Cancel Confirmation Dialog -->
    <van-dialog 
      v-model:show="showBatchCancelDialog" 
      title="批量取消休息" 
      show-cancel-button 
      @confirm="handleBatchCancel"
    >
      <div style="text-align: center; padding: 20px;">
        确定要取消选中的 {{ batchSelectedSlots.length }} 个休息时间段吗？
      </div>
    </van-dialog>

    <!-- Batch Set Offline Dialog -->
    <van-dialog v-model:show="showBatchOfflineDialog" title="批量设置休息时间" show-cancel-button @confirm="handleBatchSetOffline">
      <van-form>
        <div style="padding: 10px; text-align: center; color: #666;">
            已选择 {{ batchSelectedSlots.length }} 个时间段
        </div>
        <van-field
          v-model="offlineReason"
          label="理由"
          placeholder="请输入休息理由"
        />
      </van-form>
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
import { ref, computed, onMounted, onUnmounted, reactive } from 'vue';
import { Calendar, NavBar, Divider, Empty, Grid, GridItem, Popup, Form, Field, CellGroup, RadioGroup, Radio, Button, showToast, NoticeBar, Dialog, Cell } from 'vant';
import dayjs from 'dayjs';
import isSameOrBefore from 'dayjs/plugin/isSameOrBefore';
import isSameOrAfter from 'dayjs/plugin/isSameOrAfter';
import { shopConfig, appointments as initialAppointments, closedDates, services } from '../data/schedule';
import { cloudStorage } from '../utils/cloudStorage';

dayjs.extend(isSameOrBefore);
dayjs.extend(isSameOrAfter);

const minDate = new Date();
const maxDate = dayjs().add(shopConfig.maxDaysAdvance, 'day').toDate();
const selectedDate = ref(new Date());
const isSyncing = ref(false); // Cloud sync status
const lastSyncTime = ref(''); // Last successful sync time
let intervalId;

// Local state
const localAppointments = ref([...initialAppointments]);
const unavailableSlots = ref([]); // Store owner-set offline slots: { date: 'YYYY-MM-DD', time: 'HH:mm', reason: '...' }
const isOwner = ref(false);
const isBatchMode = ref(false);
const batchSelectedSlots = ref([]);
const showBatchOfflineDialog = ref(false);
const showBatchCancelDialog = ref(false);

const loadFromCloud = async (isBackground = false) => {
  isSyncing.value = true;
  const data = await cloudStorage.loadData(isBackground);
  if (data) {
    // Basic merge: update local state with cloud data
    // In a real app, we might need more complex merging if local has unsaved changes
    if (data.appointments) localAppointments.value = data.appointments;
    if (data.unavailableSlots) unavailableSlots.value = data.unavailableSlots;
    
    // Update local storage
    localStorage.setItem('appointments', JSON.stringify(localAppointments.value));
    localStorage.setItem('unavailableSlots', JSON.stringify(unavailableSlots.value));
    
    lastSyncTime.value = dayjs().format('HH:mm:ss');
  }
  isSyncing.value = false;
};

const saveToCloud = async () => {
  isSyncing.value = true;
  
  // Safe Save: Fetch -> Merge -> Save
  // 1. Fetch latest cloud data
  const cloudData = await cloudStorage.loadData(true); // silent load
  
  let finalAppointments = localAppointments.value;
  let finalUnavailableSlots = unavailableSlots.value;

  if (cloudData) {
      // 2. Merge Logic
      // Strategy: Union of Cloud and Local. 
      // Since we don't have IDs for everything, we use JSON string comparison or simple concat + dedup.
      // For appointments: We trust our Local "add/remove" operations are valid.
      // But if someone else added an appointment, we want to keep it.
      
      // Simple approach: 
      // If we just added an appointment, our local list has it. Cloud might have others.
      // Merging is hard without unique IDs. 
      // Let's assume for now that `localAppointments` IS the source of truth for THIS user's actions.
      // But we need to include others' actions.
      
      // Better Strategy for this app:
      // We rely on the fact that we just loaded the data before user interaction? No, user interacts then we save.
      // So:
      // a. Take Cloud Data.
      // b. Apply the "Diff" of what we just changed? Too hard.
      
      // Fallback to "Last Write Wins" BUT with a quick fetch before write to minimize window.
      // Since we just fetched 'cloudData' above, let's use it as base?
      // No, because 'localAppointments' already has the user's new booking.
      
      // Let's try to combine them intelligently.
      // Combine arrays and remove exact duplicates.
      
      const mergeArrays = (arr1, arr2) => {
          const combined = [...(arr1 || []), ...(arr2 || [])];
          const unique = [];
          const map = new Map();
          for (const item of combined) {
              const key = JSON.stringify(item);
              if (!map.has(key)) {
                  map.set(key, true);
                  unique.push(item);
              }
          }
          return unique;
      };
      
      finalAppointments = mergeArrays(cloudData.appointments, localAppointments.value);
      finalUnavailableSlots = mergeArrays(cloudData.unavailableSlots, unavailableSlots.value);
      
      // Update local state with the merged result so UI reflects it
      localAppointments.value = finalAppointments;
      unavailableSlots.value = finalUnavailableSlots;
  }

  const data = {
    appointments: finalAppointments,
    unavailableSlots: finalUnavailableSlots
  };
  
  const success = await cloudStorage.saveData(data);
  if (success) {
      lastSyncTime.value = dayjs().format('HH:mm:ss');
  }
  isSyncing.value = false;
};

// Load from localStorage then Cloud
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
  
  // Load latest data from cloud
  loadFromCloud();
  
  // Auto-refresh every 5 seconds
  intervalId = setInterval(() => loadFromCloud(true), 5000);
});

onUnmounted(() => {
  if (intervalId) clearInterval(intervalId);
});

const showBookingPopup = ref(false);
const showLoginDialog = ref(false);
const showLogoutDialog = ref(false);
const showOfflineDialog = ref(false);
const showDetailPopup = ref(false);
const currentBookingSlot = ref(null);
const currentDetailSlot = ref(null);
const selectedServiceId = ref(services[0].id);
const customerName = ref('');
const customerPhone = ref('');
const offlineReason = ref('');
const offlineStartTime = ref('');
const offlineEndTime = ref('');

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

const todayBreaks = computed(() => {
    return unavailableSlots.value
        .filter(s => s.date === formattedDate.value)
        .map(s => ({
            ...s,
            startTime: s.startTime || s.time,
            endTime: s.endTime || (s.time ? dayjs(s.date + ' ' + s.time).add(shopConfig.slotDuration || 30, 'minute').format('HH:mm') : '')
        }));
});

  // Compute announcements for today
  const todayAnnouncements = computed(() => {
    const slots = unavailableSlots.value.filter(s => s.date === formattedDate.value);
    if (slots.length === 0) return '';
    
    // Format: "15:15-15:30 休息"
    const details = slots.map(s => {
        let startTime = s.startTime || s.time;
        let endTime = s.endTime || (s.time ? dayjs(s.date + ' ' + s.time).add(shopConfig.slotDuration || 30, 'minute').format('HH:mm') : '');
        return `${startTime}-${endTime} ${s.reason}`;
    });
    
    // Find the latest end time to indicate when business resumes
    let resumeTime = '';
    if (slots.length > 0) {
        // Sort by end time
        const sortedSlots = [...slots].sort((a, b) => {
             let endA = a.endTime || (a.time ? dayjs(a.date + ' ' + a.time).add(shopConfig.slotDuration || 30, 'minute').format('HH:mm') : '');
             let endB = b.endTime || (b.time ? dayjs(b.date + ' ' + b.time).add(shopConfig.slotDuration || 30, 'minute').format('HH:mm') : '');
             return endA > endB ? -1 : 1; // Descending
        });
        
        const latestSlot = sortedSlots[0];
        const latestEnd = latestSlot.endTime || (latestSlot.time ? dayjs(latestSlot.date + ' ' + latestSlot.time).add(shopConfig.slotDuration || 30, 'minute').format('HH:mm') : '');
        resumeTime = `，预计 ${latestEnd} 恢复营业`;
    }
    
    return `温馨提示：${formattedDate.value} 店家休息安排：${details.join('，')}${resumeTime}。`;
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
    const slotEndStr = slotEnd.format('HH:mm');
    
    // 1. Check if manually set offline by owner
    const offlineSlot = unavailableSlots.value.find(s => {
       if (s.date !== dateStr) return false;
       
       let sStart = s.startTime || s.time;
       let sEnd = s.endTime;
       
       // Handle legacy exact match or single-point breaks
       if (!sEnd && s.time) {
           return s.time === timeStr;
       }
       
       // Overlap logic: (BreakStart < SlotEnd) && (BreakEnd > SlotStart)
       if (sStart && sEnd) {
           return sStart < slotEndStr && sEnd > timeStr;
       }
       return false;
    });
    
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
    let offlineData = null; // Store full offline object for cancellation
    
    if (offlineSlot) {
      status = 'offline';
      reason = offlineSlot.reason;
      offlineData = offlineSlot;
    } else if (appointment) {
      status = 'booked';
    } else if (dayjs(dateStr).isSame(dayjs(), 'day')) {
      if (slotStart.isBefore(dayjs())) {
        status = 'past'; 
      }
    }

    slots.push({ time: timeStr, status, appointment, reason, offlineData });
    current = current.add(slotDuration, 'minute');
  }
  return slots;
});

const onDateSelect = (date) => {
  selectedDate.value = date;
};

const handleLoginClick = () => {
  if (isOwner.value) {
    showLogoutDialog.value = true;
  } else {
    showLoginDialog.value = true;
    loginForm.username = '18127313318'; // Pre-fill for convenience
    loginForm.password = '';
  }
};

const handleLogoutConfirm = () => {
  isOwner.value = false;
  localStorage.removeItem('isOwner');
  showToast('已退出登录');
  showLogoutDialog.value = false;
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
    // Batch mode handling
    if (isBatchMode.value) {
        if (slot.status === 'booked') {
            showToast('无法选择已预约的时间段');
            return;
        }
        
        const index = batchSelectedSlots.value.indexOf(slot.time);
        if (index > -1) {
            batchSelectedSlots.value.splice(index, 1);
        } else {
            batchSelectedSlots.value.push(slot.time);
        }
        return;
    }

    // Owner interactions
    if (slot.status === 'available') {
      currentBookingSlot.value = slot;
      offlineReason.value = '';
      
      // Pre-fill time
      offlineStartTime.value = slot.time;
      // Calculate end time
      const duration = shopConfig.slotDuration || 30;
      const [h, m] = slot.time.split(':').map(Number);
      const endD = dayjs().hour(h).minute(m).add(duration, 'minute');
      offlineEndTime.value = endD.format('HH:mm');

      showOfflineDialog.value = true;
    } else if (slot.status === 'booked') {
      currentDetailSlot.value = slot;
      showDetailPopup.value = true;
    } else if (slot.status === 'offline') {
       // Find the specific rule blocking this slot
       const duration = shopConfig.slotDuration || 30;
       const slotStartStr = slot.time;
       const [h, m] = slotStartStr.split(':').map(Number);
       const slotEndStr = dayjs().hour(h).minute(m).add(duration, 'minute').format('HH:mm');

       const blockingRule = unavailableSlots.value.find(s => {
           if (s.date !== formattedDate.value) return false;
           
           let sStart = s.startTime || s.time;
           let sEnd = s.endTime;
           
           // Legacy exact match
           if (!sEnd && s.time) {
               return s.time === slot.time;
           }
           
           // Overlap check
           return sStart < slotEndStr && sEnd > slotStartStr;
       });

       if (!blockingRule) {
           showToast('未找到对应的休息规则');
           return;
       }

       Dialog.confirm({
        title: '取消休息',
        message: `确定要取消 ${blockingRule.startTime || blockingRule.time} - ${blockingRule.endTime || '未知'} 的休息安排吗？`,
      }).then(() => {
        unavailableSlots.value = unavailableSlots.value.filter(s => s !== blockingRule);
        
        localStorage.setItem('unavailableSlots', JSON.stringify(unavailableSlots.value));
        saveToCloud();
        showToast('已恢复营业');
      }).catch(() => {
        // Cancelled
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

const cancelBatchMode = () => {
  isBatchMode.value = false;
  batchSelectedSlots.value = [];
};

const isBatchCancelMode = computed(() => {
    if (batchSelectedSlots.value.length === 0) return false;
    const duration = shopConfig.slotDuration || 30;
    
    // Check if ALL selected slots are ALREADY offline
    return batchSelectedSlots.value.every(slotTime => {
        const slotStartStr = slotTime;
        const [h, m] = slotStartStr.split(':').map(Number);
        const slotEndStr = dayjs().hour(h).minute(m).add(duration, 'minute').format('HH:mm');

        // Check overlap with existing rules
        return unavailableSlots.value.some(s => {
            if (s.date !== formattedDate.value) return false;
            let sStart = s.startTime || s.time;
            let sEnd = s.endTime || (s.time ? dayjs(s.date + ' ' + s.time).add(duration, 'minute').format('HH:mm') : '');
            return sStart < slotEndStr && sEnd > slotStartStr;
        });
    });
});

const finishBatchMode = () => {
  if (batchSelectedSlots.value.length === 0) return;

  if (isBatchCancelMode.value) {
      showBatchCancelDialog.value = true;
  } else {
      offlineReason.value = '';
      showBatchOfflineDialog.value = true;
  }
};

const handleBatchCancel = () => {
    const duration = shopConfig.slotDuration || 30;
    
    // Filter out rules that overlap with ANY selected slot
    unavailableSlots.value = unavailableSlots.value.filter(s => {
        if (s.date !== formattedDate.value) return true;
        
        let sStart = s.startTime || s.time;
        let sEnd = s.endTime || (s.time ? dayjs(s.date + ' ' + s.time).add(duration, 'minute').format('HH:mm') : '');
        
        // Check if this rule overlaps with ANY selected slot
        const isOverlapping = batchSelectedSlots.value.some(slotTime => {
            const [h, m] = slotTime.split(':').map(Number);
            const slotEndStr = dayjs().hour(h).minute(m).add(duration, 'minute').format('HH:mm');
            return sStart < slotEndStr && sEnd > slotTime;
        });
        
        return !isOverlapping; // Keep if NOT overlapping
    });
    
    localStorage.setItem('unavailableSlots', JSON.stringify(unavailableSlots.value));
    saveToCloud();
    showToast(`已取消 ${batchSelectedSlots.value.length} 个休息时间段`);
    cancelBatchMode();
};

const handleBatchSetOffline = () => {
    if (!offlineReason.value) {
        showToast('请输入理由');
        return;
    }
    
    const duration = shopConfig.slotDuration || 30;
    
    // First, remove any existing rules that overlap with the new slots (to avoid duplicates or conflicts)
    // Using the same logic as handleBatchCancel but without the user confirmation
    unavailableSlots.value = unavailableSlots.value.filter(s => {
        if (s.date !== formattedDate.value) return true;
        let sStart = s.startTime || s.time;
        let sEnd = s.endTime || (s.time ? dayjs(s.date + ' ' + s.time).add(duration, 'minute').format('HH:mm') : '');
        
        const isOverlapping = batchSelectedSlots.value.some(slotTime => {
            const [h, m] = slotTime.split(':').map(Number);
            const slotEndStr = dayjs().hour(h).minute(m).add(duration, 'minute').format('HH:mm');
            return sStart < slotEndStr && sEnd > slotTime;
        });
        return !isOverlapping;
    });
    
    batchSelectedSlots.value.forEach(timeStr => {
        const [h, m] = timeStr.split(':').map(Number);
        const endD = dayjs().hour(h).minute(m).add(duration, 'minute');
        const endTimeStr = endD.format('HH:mm');
        
        unavailableSlots.value.push({
            date: formattedDate.value,
            time: timeStr,
            startTime: timeStr,
            endTime: endTimeStr,
            reason: offlineReason.value
        });
    });// Save
    localStorage.setItem('unavailableSlots', JSON.stringify(unavailableSlots.value));
    saveToCloud();
    showToast(`成功设置 ${batchSelectedSlots.value.length} 个休息时间段`);
    showBatchOfflineDialog.value = false;
    cancelBatchMode();
};

const handleSetOffline = () => {
  if (!offlineReason.value) {
    showToast('请输入理由');
    return;
  }
  if (!offlineStartTime.value || !offlineEndTime.value) {
     showToast('请完整填写时间');
     return;
  }
  
  if (offlineStartTime.value >= offlineEndTime.value) {
      showToast('结束时间必须晚于开始时间');
      return;
  }

  unavailableSlots.value.push({
    date: formattedDate.value,
    time: currentBookingSlot.value.time,
    startTime: offlineStartTime.value,
    endTime: offlineEndTime.value,
    reason: offlineReason.value
  });
  localStorage.setItem('unavailableSlots', JSON.stringify(unavailableSlots.value));
  saveToCloud();
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
  
  // Save to Cloud
  saveToCloud();
  
  showToast('预约成功！');
  showBookingPopup.value = false;
  
  // Reset form
  customerName.value = '';
  customerPhone.value = '';
  selectedServiceId.value = services[0].id;
};

const cancelAppointment = () => {
  Dialog.confirm({
    title: '取消预约',
    message: '确定要取消该预约吗？',
  }).then(() => {
    // Remove from localAppointments
    // Fix: Find the appointment object, not the slot object
    // currentDetailSlot is the slot object which contains the appointment
    if (!currentDetailSlot.value || !currentDetailSlot.value.appointment) return;
    
    const appointment = currentDetailSlot.value.appointment;
    const index = localAppointments.value.indexOf(appointment);
    
    if (index > -1) {
      localAppointments.value.splice(index, 1);
      localStorage.setItem('appointments', JSON.stringify(localAppointments.value));
      saveToCloud();
      showToast('预约已取消');
      showDetailPopup.value = false;
    } else {
        // Fallback: Try to find by id or other properties if object reference differs
        const idx = localAppointments.value.findIndex(a => 
            a.date === appointment.date && 
            a.time === appointment.time && 
            a.customerPhone === appointment.customerPhone
        );
        if (idx > -1) {
            localAppointments.value.splice(idx, 1);
            localStorage.setItem('appointments', JSON.stringify(localAppointments.value));
            saveToCloud();
            showToast('预约已取消');
            showDetailPopup.value = false;
        }
    }
  }).catch(() => {
    // on cancel
  });
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
.time-slot.batch-selected {
  background-color: #e6f7ff;
  border-color: #1890ff;
  color: #1890ff;
  position: relative;
}
.time-slot.batch-selected::after {
    content: '✔';
    position: absolute;
    top: 0;
    right: 0;
    background: #1890ff;
    color: white;
    font-size: 10px;
    padding: 0 4px;
    border-bottom-left-radius: 4px;
}
</style>
