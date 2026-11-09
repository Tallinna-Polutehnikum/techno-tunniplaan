import { createRouter, createWebHashHistory } from 'vue-router';
import TimetableView from './views/TimetableView.vue';
import FreeRoomsView from './views/FreeRoomsView.vue';
import LunchView from './views/LunchView.vue';
import SettingsView from './views/SettingsView.vue';
import GeneralSettingsView from './views/GeneralSettingsView.vue';
import ThemeSettingsView from './views/ThemeSettingsView.vue';
import KioskHome from './views/kiosk/KioskHome.vue';
import KioskPick from './views/kiosk/KioskPick.vue';
import KioskNow from './views/kiosk/KioskNow.vue';
import KioskBuildingPick from './views/kiosk/KioskBuildingPick.vue';
import KioskGroups from './views/kiosk/KioskGroups.vue';
import KioskRooms from './views/kiosk/KioskRooms.vue';
import KioskToday from './views/kiosk/KioskToday.vue';
import KioskTeachers from './views/kiosk/KioskTeachers.vue';
import KioskFreeRooms from './views/kiosk/KioskFreeRooms.vue';
import KioskWeek from './views/kiosk/KioskWeek.vue';
import KioskLunch from './views/kiosk/KioskLunch.vue';

// Hash URLs (#/seaded): GitHub Pages cannot send other paths to the app, and they work offline in the PWA too.
export default createRouter({
  history: createWebHashHistory(),
  routes: [
    { path: '/', name: 'timetable', component: TimetableView },
    // a shareable link to one group's, teacher's or room's timetable, the view in the query (see deepLink.js)
    { path: '/plaan/:type(group|teacher|room)/:name', name: 'timetable-for', component: TimetableView },
    { path: '/vabad-ruumid', name: 'free-rooms', component: FreeRoomsView },
    { path: '/louna', name: 'lunch', component: LunchView },
    {
      path: '/seaded',
      component: SettingsView,
      children: [
        { path: '', name: 'settings', component: GeneralSettingsView },
        { path: 'teema', name: 'theme-settings', component: ThemeSettingsView },
      ],
    },
    // Kiosk mode (settings → Kioskirežiim); 'tana' pickers lead to today's lessons, 'plaan' ones to the full timetable
    { path: '/kiosk', name: 'kiosk', component: KioskHome },
    { path: '/kiosk/vali/:purpose(tana|plaan)', name: 'kiosk-pick', component: KioskPick, props: true },
    { path: '/kiosk/praegu', name: 'kiosk-now', component: KioskNow },
    { path: '/kiosk/hoone', name: 'kiosk-building', component: KioskBuildingPick },
    { path: '/kiosk/hoone/:building', name: 'kiosk-building-now', component: KioskNow, props: true },
    { path: '/kiosk/ruhmad/:purpose(tana|plaan)/:year?', name: 'kiosk-groups', component: KioskGroups, props: true },
    { path: '/kiosk/ruumid/:purpose(tana|plaan)/:building?', name: 'kiosk-rooms', component: KioskRooms, props: true },
    { path: '/kiosk/opetajad/:purpose(tana|plaan)', name: 'kiosk-teachers', component: KioskTeachers, props: true },
    { path: '/kiosk/tana/:type(group|teacher|room)/:name', name: 'kiosk-today', component: KioskToday, props: true },
    { path: '/kiosk/vabad-ruumid', name: 'kiosk-free', component: KioskFreeRooms },
    { path: '/kiosk/louna', name: 'kiosk-lunch', component: KioskLunch },
    {
      path: '/kiosk/nadal/:type(group|teacher|room)/:name',
      name: 'kiosk-week',
      component: KioskWeek,
      props: (route) => ({ ...route.params, week: route.query.week ?? '' }),
    },
    { path: '/:pathMatch(.*)*', redirect: '/' },
  ],
  scrollBehavior: () => ({ top: 0 }),
});
