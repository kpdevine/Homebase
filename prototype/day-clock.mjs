// Daily records follow the device's wall clock, with a one-hour grace period.
// Keep date-only arithmetic separate from instants so DST cannot shift history.
export function localDateKey(date = new Date(), timeZone) {
  const parts = new Intl.DateTimeFormat('en-US', { timeZone, year:'numeric', month:'2-digit', day:'2-digit' }).formatToParts(date);
  const part = type => parts.find(item => item.type === type).value;
  return `${part('year')}-${part('month')}-${part('day')}`;
}

// Device-local midnight, including 23/25-hour daylight-saving days.
export function millisecondsUntilLocalMidnight(date=new Date()) {
  const next=new Date(date);next.setHours(24,0,0,0);
  return Math.max(1,next.getTime()-date.getTime());
}

export function localHour(date = new Date(), timeZone) {
  return Number(new Intl.DateTimeFormat('en-US', {timeZone, hour:'numeric', hourCycle:'h23'}).format(date));
}

export function appDateKey(date = new Date(), timeZone) {
  const key = localDateKey(date, timeZone);
  if(localHour(date, timeZone) >= 1)return key;
  const previous = new Date(`${key}T12:00:00Z`);
  previous.setUTCDate(previous.getUTCDate() - 1);
  return previous.toISOString().slice(0, 10);
}

export function timeGreeting(date = new Date(), timeZone) {
  const hour = localHour(date, timeZone);
  return hour<5 || hour>=21 ? 'Good night' : hour<12 ? 'Good morning' : hour<17 ? 'Good afternoon' : 'Good evening';
}

export function lateCheckInWindow(date = new Date(), timeZone) {
  const hour = localHour(date, timeZone);
  return hour>=21 || hour<1;
}

// Remember whether the screen follows Today, independently of a delayed refresh.
// An open form/menu can finish on its original date after the wall clock rolls over.
export function createDayRollover(today) {
  let observedToday = today, followingToday = true, pending = false;
  return {
    select(date, currentToday) {
      observedToday = currentToday;
      followingToday = date === currentToday;
      pending = false;
    },
    tick(currentToday, {busy=false}={}) {
      if(currentToday !== observedToday) {
        observedToday = currentToday;
        pending = true;
      }
      if(!pending || busy)return null;
      pending = false;
      return {today:currentToday, followToday:followingToday};
    },
  };
}
