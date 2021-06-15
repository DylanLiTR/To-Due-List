// get current date and set up calendar presets
var today = new Date();
var todayISO = new Date(today - today.getTimezoneOffset() * 60 * 1000).toISOString();
var months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
var days = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
if (today.getFullYear() % 4 === 0) {
    days[1] = 29;
}

var muted = false, pings = [];

// execute code after popup.html has loaded in
window.onload = function () {
    // declare variables
    var create = document.getElementById("create"), title = document.getElementById("title"), acc = document.getElementsByClassName("accordion");
    var sort = document.getElementById("sort"), mode = document.getElementById("mode"), notif = document.getElementById("notif"), mute = document.getElementById("mute"), form = document.getElementById("form"), overlay = document.getElementById("pickNotifs");
    var listO = document.getElementById("ongoing"), listC = document.getElementById("complete");
    var Name = title.value;
    
    // retrieve all task data from chrome storage
    chrome.storage.sync.get(null, function (data) {
        var ongoing = data["Ongoing"], complete = data["Complete"], alarms = data["alarms"];
        
        // set title of the task list
        if (data["Name"] !== undefined) {
            title.value = data["Name"];
        } else {
            chrome.storage.sync.set({Name});
        }
        
        if (ongoing === undefined) {
            ongoing = [];
            chrome.storage.sync.set({Ongoing: []});
        }
        if (complete === undefined) {
            complete = [];
            chrome.storage.sync.set({Complete: []});
        }
        if (alarms === undefined) {
            alarms = [];
            chrome.storage.sync.set({alarms: []});
        }
        
        // create tasks in html from the stored data
        for (var i = 0; i < ongoing.length; i += 1) {
            newTask(null, i + 1, ongoing[i][1], ongoing[i][2], ongoing[i][3], ongoing[i][4], ongoing[i][5]);
        }
        for (var i = 0; i < complete.length; i += 1) {
            newTask(null, i + 1, complete[i][1], complete[i][2], complete[i][3], complete[i][4], complete[i][5]);
        }
        if (!alarms.length) {
            notif.firstChild.classList.toggle("fa-bell-o");
            notif.firstChild.classList.toggle("fa-bell-slash-o");
        } else {
            for (var i = 0; i < alarms.length; i += 1) {
                document.getElementById(alarms[i] + "min").checked = true;
            }
            pings = alarms;
        }
        
        listO.style.display = "block", listC.style.display = "block";
        
        // set saved settings
        if (data["mode"] == "light") {
            daynight();
        }
        if (data["muted"]) {
            muted = true;
            mute.title = "Unmute";
            mute.firstChild.classList.toggle("fa-volume-up");
            mute.firstChild.classList.toggle("fa-volume-off");
        }
        
        // add event listeners to autosave
        if (ongoing.length + complete.length < 100) {
            create.addEventListener("click", newTask);
        } else {
            create.style.display = "none";
        }
        
        count();
    });

    // add accordion function listener
    for (i = 0; i < acc.length; i++) {
        acc[i].addEventListener("click", expand);
    }
    title.addEventListener("input", rename);
    sort.addEventListener("click", chrono);
    mode.addEventListener("click", daynight);
    mute.addEventListener("click", sound);
    notif.addEventListener("click", function () {
        overlay.style.display = "block";
    });
    form.addEventListener("submit", function (e) {
        e.preventDefault();
        schedule();
        overlay.style.display = "none";
    })
    
    log();
}

// change the number of day options
function calendar(month) {
    var m = month.currentTarget.firstChild.value, d = month.currentTarget.nextSibling.firstChild, count = d.childNodes.length - 2, dir = 1;
    
    if (days[m - 1] > count) {
        for (var i = count + 1; i <= days[m - 1]; i += 1) {
            d.innerHTML += "<option value='" + i + "'>" + i + "</option>";
        }
    } else if (days[m - 1] < count) {
        for (var i = days[m - 1]; i <= count; i += 1) {
            console.log(d.lastChild);
            d.removeChild(d.lastChild);
        }
    }
}

// sort tasks by date
function chrono() {
    chrome.storage.sync.get("Ongoing", function(tasks) {
        var order = tasks["Ongoing"], entry = {}, table = document.getElementById("ongoing");
        order.sort(function (a, b) {
            var A = ISO(a[2], a[3], a[4]);
            var B = ISO(b[2], b[3], b[4]);
            
            return A > B ? 1 : A < B ? -1 : 0;
        });
        
        table.innerHTML = "";
        for (var i = 0; i < order.length; i += 1) {
            order[i][0] = i;
            newTask(null, i + 1, order[i][1], order[i][2], order[i][3], order[i][4], order[i][5]);
        }
        
        entry["Ongoing"] = order;
        chrome.storage.sync.set(entry);
        
        schedule();
        log();
    });
}

// count number of tasks
function count() {
    var acc = document.getElementsByClassName("accordion"), listO = document.getElementById("ongoing"), listC = document.getElementById("complete");
    
    acc[0].innerHTML = "Ongoing (" + listO.childElementCount + ")";
    acc[1].innerHTML = "Completed (" + listC.childElementCount + ")";
}

// change mode
function daynight(click) {
    var btn = document.getElementById("mode");
    var dark = btn.firstChild.classList.toggle("fa-moon-o"), light = btn.firstChild.classList.toggle("fa-sun-o");
    
    document.body.classList.toggle("light");
    
    // change tooltip
    if (dark) {
        btn.title = "Light Mode";
    } else if (light) {
        btn.title = "Dark Mode";
    }
    
    // if not clicked, it is from storage
    if (!click) {
        return 0;
    }
    
    // set storage value
    chrome.storage.sync.get("mode", function (mode) {
        if (mode["mode"] == "light") {
            chrome.storage.sync.set({"mode": "dark"});
        } else {
            chrome.storage.sync.set({"mode": "light"});
        }
    });
}

// expand accordion
function expand(target) {
    target.currentTarget.classList.toggle("active");
    var panel = this.nextElementSibling;
    if (panel.style.maxHeight) {
        panel.style.maxHeight = null;
    } else {
        panel.style.maxHeight = panel.scrollHeight + "px";
    }
}

// insert a task in a different position on the list
function insert(option) {
    // initiate variables
    var table, positions, task, type, entry = {}, stored = {};
    var oldVal = option.currentTarget.pos, newVal = option.currentTarget.firstChild.selectedIndex, dir = 1;
    
    // change the direction of the for loop to save correctly
    if (newVal >= oldVal) {
        dir = -1;
    }
    
    if (option.currentTarget.parentElement.childNodes[5].firstChild.checked) {
        type = "Complete";
        table = document.getElementById("complete");
        positions = document.getElementsByClassName("posC");
    } else {
        type = "Ongoing";
        table = document.getElementById("ongoing");
        positions = document.getElementsByClassName("posO");
    }
    stored[type] = type;
    
    chrome.storage.sync.get(stored, function (tasks) {
        var keys = Object.keys(tasks);
        
        // change the selected index of all affected tasks between the initial and final position
        for (var i = newVal; i * dir < (oldVal - 1) * dir; i += dir) {
            table.childNodes[i].firstChild.firstChild.selectedIndex += dir;
            table.childNodes[i].firstChild.pos += dir;

            // add each task data value to the task array
            task = [];
            task.push(i - 1 + dir);
            for (var j = 1; j < table.childNodes[i].childElementCount - 2; j += 1) {
                task.push(table.childNodes[i].childNodes[j].firstChild.value);
            }
            if (table.childNodes[i].childNodes[j].firstChild.checked == true) {
                task.push("checked");
            } else {
                task.push("");
            }
            
            tasks[keys[0]][i + dir] = task;
        }
        entry[keys[0]] = tasks[keys[0]];
        chrome.storage.sync.set(entry);
        
        // store task data in local variable
        task = table.childNodes[oldVal - 1];

        // update position attribute
        task.firstChild.pos = newVal + 1;

        // remove task at initial position
        table.removeChild(table.childNodes[oldVal - 1]);

        // insert task from local variable
        var inserted = table.insertBefore(task, table.childNodes[newVal]);

        // save inserted task to chrome storage
        save(task, newVal);

        // add css glow to indicate insertion
        inserted.classList.remove("glow");
        inserted.classList.add("glow");
    });
    
    var current, next, time, index = 0;
    
    // replace each old alarm with the one above it
    for (var i = (oldVal - 1 - dir); i * dir > newVal * dir; i -= dir) {
        for (var j = 0; j < pings.length; j += 1) {
            current = i + "/" + pings[j], next = (i - dir) + "/" + pings[j];
            shift(current, next);
        }
    }
    
    // set alarm data of inserted task
    for (var i = 0; i < pings.length; i += 1) {
        next = (oldVal - 1) + "/" + pings[i];
        chrome.alarms.get(next, function (alarm) {
            current = newVal + "/" + pings[index];
            if (alarm === undefined) {
                chrome.alarms.clear(current);
            } else {
                time = alarm["scheduledTime"];
                chrome.alarms.create(current, {when: time});
            }
            index += 1;
        });
    }
    
    // overwrite old value
    for (var i = 0; i < pings.length; i += 1) {
        current = (oldVal - 1) + "/" + pings[i], next = (oldVal - 1 - dir) + "/" + pings[i];
        shift(current, next);
    }
}

// get ISO string date from month, day, and time
function ISO(MM, DD, clock) {
    MM = MM.toString(), DD = DD.toString();
    if (MM.length == 1) {
        MM = "0" + MM;
    }
    if (DD.length == 1) {
        DD = "0" + DD;
    }
    
    var time = today.getFullYear() + "-" + MM + "-" + DD + "T" + clock + ":00Z";
    if (time < todayISO) {
        return today.getFullYear() + 1 + "-" + MM + "-" + DD + "T" + clock + ":00Z"
    } else {
        return time;
    }
}

// log the storage and alarms to the console
function log() {
    chrome.storage.sync.get(null, function (tasks) {
        console.log(tasks);
    });
    chrome.alarms.getAll(function (alarms) {
        var print = [];
        for (alarm in alarms) {
            date = new Date(alarms[alarm].scheduledTime);
            print.push([alarms[alarm].name, date.toLocaleDateString() + " " + date.toLocaleTimeString()]);
        }
        console.log(print);
    });
}

// create a new task
function newTask(action, index, desc, mm, dd, t, ch) {
    // initiate variables
    var task = document.createElement("tr");
    var listO = document.getElementById("ongoing"), listC = document.getElementById("complete"), posO = document.getElementsByClassName("posO"), posC = document.getElementsByClassName("posC");
    var options = "", entry = {}, stored = {}, type, table, position, posClass;
    var priority, description, month, day, check, del;
    
    // create td template
    priority = document.createElement("td"), description = document.createElement("td"), month = document.createElement("td"), day = document.createElement("td"), time = document.createElement("td"), check = document.createElement("td"), del = document.createElement("td");
    
    // define undefined values
    if (desc === undefined) {
        desc = "";
    }
    if (ch === undefined) {
        ch = "";
    }
    if (mm === undefined) {
        mm = today.getMonth() + 1;
    }
    if (dd === undefined) {
        dd = today.getDate();
    }
    if (t === undefined) {
        t = "00:00";
    }
    
    // add a select tag and options to the month
    var selectM = "", selectD = "";
    for (var i = 1; i <= 12; i += 1) {
        if (i == mm) {
            selectM += "<option selected value='" + i + "'>" + months[i - 1] + "</option>";
        } else {
            selectM += "<option value='" + i + "'>" + months[i - 1] + "</option>";
        }
    }
    month.innerHTML = "<select class='month'> " + selectM + " </select>";
    
    // add options to the day
    for (var i = 1; i <= days[mm - 1]; i += 1) {
        if (i == dd) {
            selectD += "<option selected value='" + i + "'>" + i + "</option>";
        } else {
            selectD += "<option value='" + i + "'>" + i + "</option>";
        }
    }
    day.innerHTML = "<select> " + selectD + " </select>";
    
    // add appropriate html tags with input from chrome storage
    description.innerHTML = "<input placeholder='Task' type='text' maxlength='48' autocomplete='off' value='" + desc + "'>";
    time.innerHTML = "<input type='time' value='" + t + "'>"
    check.innerHTML = "<input type='checkbox'" + ch + ">";
    del.innerHTML = "<button class='delete' style='padding: none'><img src='images/delete.png' draggable='false' style='width: 16px; margin: none'></button>";
    
    // create all position options from chrome storage
    if (ch == "checked") {
        type = "Complete";
        table = document.getElementById("complete");
        position = document.getElementsByClassName("posC");
        posClass = "posC";
    } else {
        type = "Ongoing";
        table = document.getElementById("ongoing");
        position = document.getElementsByClassName("posO");
        posClass = "posO";
    }
    stored[type] = type;

    // add new position option to existing tasks
    for (var i = 0; i < position.length; i += 1) {
        position[i].innerHTML += "<option value='" + (position.length + 1) + "'>" + (position.length + 1) + "</option>";
    }
    
    // create priority ranking select
    chrome.storage.sync.get(stored, function (tasks) {
        var keys = Object.keys(tasks);

        // create an option for each existing task position
        for (var i = 1; i <= tasks[keys[0]].length; i += 1) {
            // makes the current position the selected option
            if (i == index) {
                options += "<option selected value='" + i + "'>" + i + "</option>"
            } else {
                options += "<option value='" + i + "'>" + i + "</option>";
            }
            // new task creates a new option at the end of the list, which is the current position and selected
            if (i == tasks[keys[0]].length && index === undefined) {
                options += "<option selected value='" + (tasks[keys[0]].length + 1) + "'>" + (tasks[keys[0]].length + 1) + "</option>";
            }
        }

        // creates option if it is the first task
        if (options === "") {
            options += "<option value='1'>1</option>";
        }

        // completes the select tag
        priority.innerHTML = "<select class='" + posClass + "'>" + options + "</select>";

        // if index is not passed in as an argument, it is set to the current, new task's index
        if (index === undefined) {
            index = priority.firstChild.value;
            var data = [index, desc, mm, dd, t, ch];
            tasks[keys[0]].push(data);

            // submits the data to chrome storage
            entry[keys[0]] = tasks[keys[0]];
            chrome.storage.sync.set(entry);
            
            // expand accordion if closed
            if (!table.previousElementSibling.classList.contains("active")) {
                table.previousElementSibling.classList.toggle("active");
                table.style.maxHeight = table.scrollHeight + "px";
            }
            
            reschedule(index - 1);
        }
        priority.pos = index;
    });

    // puts all task data into an array
    var row = [priority, description, month, day, time, check, del];

    // adds all data to the full task row string
    for (var i = 0; i < row.length; i += 1) {
        task.append(row[i]);
    }
    // creates the html row in the table
    table.append(task);
    
    // adds event listeners to all inputs to autosave
    priority.addEventListener("change", insert);
    description.addEventListener("input", sync);
    month.addEventListener("change", function (e) {
        sync(e);
        calendar(e);
        reschedule(priority.firstChild.selectedIndex);
    });
    day.addEventListener("change", function (e) {
        sync(e);
        reschedule(priority.firstChild.selectedIndex);
    });
    time.addEventListener("change", function (e) {
        sync(e);
        reschedule(priority.firstChild.selectedIndex);
    });
    check.addEventListener("change", function () {
        save(task, priority.firstChild.selectedIndex, true);
        // play sound when a task is checked off
        if (task.childNodes[5].firstChild.checked === true && !muted) {
            var audio = new Audio("audio/ding.mp3");
            audio.play();
        }
    });
    del.addEventListener("click", remove);
    
    // disable create button and function if 99 tasks exist
    if (posO.length + posC.length >= 100) {
        create.removeEventListener("click", newTask);
        create.style.display = "none";
    }
    
    // resize accordion
    if (table.previousElementSibling.classList.contains("active")) {
        table.style.maxHeight = table.scrollHeight + "px";
    }
    
    // reorganize all selects
    for (var i = 0; i < posO.length; i += 1) {
        posO[i].selectedIndex = i;
    }
    count();
}

// remove task from table and chrome storage
function remove(target, parent, checked) {
    // initiate variables
    var create = document.getElementById("create"), listC = document.getElementById("complete"), listO = document.getElementById("ongoing");
    var table, position, task, type, entry = {}, stored = {};
    
    if (target === null) {
        task = parent;
    } else {
        task = target.currentTarget.parentElement;
        if (!muted) {
            var audio = new Audio("audio/trash.mp3");
            audio.play();
        }
    }
    
    // re-enable the create button and function when a task is deleted at maximum capacity
    if (listO.childNodes.length + listC.childNodes.length == 100) {
        create.style.display = "block";
        create.addEventListener("click", newTask);
    }
    
    // hide table if no tasks
    if (listO.childNodes.length + listC.childNodes.length == 1) {
        listO.style.display = "none";
        listC.style.display = "none";
    }
    
    if ((task.childNodes[5].firstChild.checked && !checked) || (!task.childNodes[5].firstChild.checked && checked)) {
        type = "Complete";
        table = listC;
        position = document.getElementsByClassName("posC");
    } else {
        type = "Ongoing";
        table = listO;
        position = document.getElementsByClassName("posO");
    }
    stored[type] = type;
    
    var end = task.firstChild.firstChild.selectedIndex;
    table.removeChild(task);
    
    count();
    
    // delete task from chrome storage
    chrome.storage.sync.get(stored, function (tasks) {
        var keys = Object.keys(tasks);
        
        // decrease the selected index of all tasks above the deleted task
        for (var i = table.childNodes.length - 1; i >= end; i -= 1) {
            table.childNodes[i].firstChild.firstChild.selectedIndex -= 1;
            table.childNodes[i].firstChild.pos -= 1;

            // add each task data value to the task array
            task = [];
            task.push(i);
            for (var j = 1; j < table.childNodes[i].childElementCount - 2; j += 1) {
                task.push(table.childNodes[i].childNodes[j].firstChild.value);
            }
            if (table.childNodes[i].childNodes[j].firstChild.checked == true) {
                task.push("checked");
            } else {
                task.push("");
            }
            
            tasks[keys[0]][i] = task;
        }

        tasks[keys[0]].pop();
        entry[keys[0]] = tasks[keys[0]];
        chrome.storage.sync.set(entry);

        // delete the last option from all selects
        for (var i = 0; i < table.childNodes.length; i += 1) {
            table.childNodes[i].firstChild.firstChild.removeChild(table.childNodes[i].firstChild.firstChild.lastChild);
        }
    });
    
    // prevent incorrect deletion of alarm
    if (table == listC) {
        return 0;
    }
    
    // delete alarm
    var current, next, last;
    
    // replace each old alarm with the one above it
    for (var i = end; i < listO.childNodes.length; i += 1) {
        for (var j = 0; j < pings.length; j += 1) {
            current = i + "/" + pings[j], next = (i + 1) + "/" + pings[j];
            shift(current, next);
        }
    }
    // delete the alarms related to the last task
    for (var i = 0; i < pings.length; i += 1) {
        last = listO.childNodes.length + "/" + pings[i];
        chrome.alarms.clear(last);
    }
}

// rename the task list
function rename() {
    clearInterval(timer);
    var timer = setTimeout(function() {
        var Name = document.getElementById("title").value;
        chrome.storage.sync.set({Name});
    }, 500);
}

// reschedule notification on change of date or time
function reschedule(key) {
    var index, time, date, task = document.getElementById("ongoing").childNodes[key];
    
    for (var i = 0; i < pings.length; i += 1) {
        index = key + "/" + pings[i];
        time = new Date(ISO(task.childNodes[2].firstChild.selectedIndex + 1, task.childNodes[3].firstChild.selectedIndex + 1, task.childNodes[4].firstChild.value)).getTime() - pings[i] * 1000 * 60 + today.getTimezoneOffset() * 60 * 1000;
        
        if (time > today.getTime()) {
            chrome.alarms.create(index, {when: time});
        }
    }
}

// save data to chrome storage
function save(parent, index, checked) {
    var task = [], entry = {}, stored = {}, type;
    task.push(index);
    
    // add each task data value to the task array
    for (var j = 1; j < parent.childElementCount - 2; j += 1) {
        task.push(parent.childNodes[j].firstChild.value);
    }
    if (parent.childNodes[j].firstChild.checked) {
        task.push("checked");
        type = "Complete";
    } else {
        task.push("");
        type = "Ongoing";
    }
    stored[type] = type;
    
    chrome.storage.sync.get(stored, function (tasks) {
        var keys = Object.keys(tasks);
        
        if (checked) {
            newTask(null, undefined, task[1], task[2], task[3], task[4], task[5]);
            remove(null, parent, true);
            return 0;
        }
        
        tasks[keys[0]][index] = task;
        entry[keys[0]] = tasks[keys[0]];
        chrome.storage.sync.set(entry);
    });
}

// schedule new notification times
function schedule() {
    var alarms = [], name, time;
    var checked = document.getElementsByClassName("prefire"), tasks = document.getElementById("ongoing").childNodes, notif = document.getElementById("notif");
    
    // add or remove alarms
    for (var i = 0; i < checked.length; i += 1) {
        if (checked[i].checked) {
            alarms.push(checked[i].value);
            for (var j = 0; j < tasks.length; j += 1) {
                name = j + "/" + checked[i].value;
                time = new Date(ISO(tasks[j].childNodes[2].firstChild.selectedIndex + 1, tasks[j].childNodes[3].firstChild.selectedIndex + 1, tasks[j].childNodes[4].firstChild.value)).getTime() - (checked[i].value - today.getTimezoneOffset()) * 60 * 1000;
                
                if (time > today.getTime()) {
                    chrome.alarms.create(name, {when: time});
                }
            }
        } else {
            for (var j = 0; j < tasks.length; j += 1) {
                name = j + "/" + checked[i].value;
                
                chrome.alarms.clear(name);
            }
        }
    }
    
    // toggle notification icon
    if (alarms.length && !pings.length) {
        notif.firstChild.classList.add("fa-bell-o");
        notif.firstChild.classList.remove("fa-bell-slash-o");
    } else if (pings.length && !alarms.length) {
        notif.firstChild.classList.remove("fa-bell-o");
        notif.firstChild.classList.add("fa-bell-slash-o");
    }
    
    // assign alarms prefires to global variable and store
    pings = alarms;
    chrome.storage.sync.set({alarms});
}

// shift alarms
function shift(current, next) {
    var time;
    chrome.alarms.get(next, function (alarm) {
        if (alarm === undefined) {
            chrome.alarms.clear(current);
        } else {
            time = alarm["scheduledTime"];
            chrome.alarms.create(current, {when: time});
        }
    });
}

// disable or enable sound
function sound() {
    var mute = document.getElementById("mute"), entry = {};
    muted = !muted;
    if (muted) {
        mute.title = "Unmute";
    } else {
        mute.title = "Mute";
    }
    mute.firstChild.classList.toggle("fa-volume-up");
    mute.firstChild.classList.toggle("fa-volume-off");
    
    entry["muted"] = muted;
    chrome.storage.sync.set(entry);
}

// prevent autosaving too quickly
function sync(input, checked) {
    // initiate variables to pass into save as arguments
    var index = input.currentTarget.parentElement.firstChild.firstChild.selectedIndex, parent = input.currentTarget.parentElement;
    
    // clear the timer
    clearInterval(timer);
    
    // create the timer
    var timer = setTimeout(function() {save(parent, index, checked);}, 500);
}