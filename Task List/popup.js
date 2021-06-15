// get current date
var today = new Date();
var muted = false, pings = [];

// execute code after popup.html has loaded in
window.onload = function () {
    // declare variables
    var create = document.getElementById("create"), title = document.getElementById("title"), acc = document.getElementsByClassName("accordion");
    var mute = document.getElementById("mute");
    var listO = document.getElementById("ongoing"), listC = document.getElementById("complete");
    var Name = title.value;
    
    // retrieve all task data from chrome storage
    chrome.storage.sync.get(null, function (data) {
        var ongoing = data["ongoing"], complete = data["complete"], alarms = data["alarms"];
        
        // set title of the task list
        if (data["Name"] !== undefined) {
            title.value = data["Name"];
        } else {
            chrome.storage.sync.set({Name});
        }
        
        // define undefined values
        if (ongoing === undefined) {
            ongoing = [];
            chrome.storage.sync.set({ongoing});
        }
        if (complete === undefined) {
            complete = [];
            chrome.storage.sync.set({complete});
        }
        if (alarms === undefined) {
            alarms = [];
            chrome.storage.sync.set({alarms});
        }
        
        // create tasks in html from the stored data
        for (var i = 0; i < ongoing.length; i += 1) {
            newTask(null, i + 1, ongoing[i][0], ongoing[i][1], ongoing[i][2], "");
        }
        for (var i = 0; i < complete.length; i += 1) {
            newTask(null, i + 1, complete[i][0], complete[i][1], complete[i][2], "checked");
        }
        
        listO.style.display = "block", listC.style.display = "block";
        
        // set saved settings
        if (!alarms.length) {
            notif.firstChild.classList.toggle("fa-bell-o");
            notif.firstChild.classList.toggle("fa-bell-slash-o");
        } else {
            for (var i = 0; i < alarms.length; i += 1) {
                document.getElementById(alarms[i] + "min").checked = true;
            }
            pings = alarms;
        }
        if (data["mode"] == "light") {
            daynight();
        }
        if (data["muted"]) {
            sound();
        }
        
        count();
    });

    // add accordion function listener
    for (i = 0; i < acc.length; i++) {
        acc[i].addEventListener("click", expand);
    }
    title.addEventListener("input", rename);
    document.getElementById("sort").addEventListener("click", chrono);
    document.getElementById("mode").addEventListener("click", daynight);
    document.getElementById("notif").addEventListener("click", function () {
        document.getElementById("pickNotifs").style.display = "block";
    });
    document.getElementById("form").addEventListener("submit", function (e) {
        e.preventDefault();
        schedule();
        document.getElementById("pickNotifs").style.display = "none";
    });
    mute.addEventListener("click", sound);
    create.addEventListener("click", newTask);
    
    log();
}

// sort tasks by date
function chrono() {
    chrome.storage.sync.get("ongoing", function(tasks) {
        var order = tasks["ongoing"], entry = {}, table = document.getElementById("ongoing");
        order.sort(function (a, b) {
            var A = a[1] + "T" + a[2] + "Z", B = b[1] + "T" + b[2] + "Z";
            
            return A > B ? 1 : A < B ? -1 : 0;
        });
        
        table.innerHTML = "";
        for (var i = 0; i < order.length; i += 1) {
            newTask(null, i + 1, order[i][0], order[i][1], order[i][2], "");
        }
        
        entry["ongoing"] = order;
        chrome.storage.sync.set(entry);
        
        schedule();
        log();
    });
}

// count number of tasks
function count() {
    document.getElementsByClassName("accordion")[0].innerHTML = "Ongoing (" + document.getElementById("ongoing").childElementCount + ")";
    document.getElementsByClassName("accordion")[1].innerHTML = "Completed (" + document.getElementById("complete").childElementCount + ")";
}

// change mode
function daynight(click) {
    var btn = document.getElementById("mode");
    var dark = btn.firstChild.classList.toggle("fa-moon-o"), light = btn.firstChild.classList.toggle("fa-sun-o");
    
    document.body.classList.toggle("light");
    
    // change tooltip and store setting if toggled
    if (light) {
        btn.title = "Dark Mode";
        if (click) {
            chrome.storage.sync.set({"mode": "light"});
        }
    } else {
        btn.title = "Light Mode";
        if (click) {
            chrome.storage.sync.set({"mode": "dark"});
        }
    }
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
    var table, task, type;
    var oldVal = Array.prototype.indexOf.call(option.currentTarget.parentElement.parentElement.children, option.currentTarget.parentElement), newVal = option.currentTarget.firstChild.selectedIndex, dir = 1;
    
    // change the direction of the for loop to save correctly
    if (newVal >= oldVal) {
        dir = -1;
    }
    
    // determine the table that the task is in
    if (option.currentTarget.parentElement.children[4].firstChild.checked) {
        type = "complete";
        table = document.getElementById("complete");
    } else {
        type = "ongoing";
        table = document.getElementById("ongoing");
    }
    
    chrome.storage.sync.get(type, function (tasks) {
        var keys = Object.keys(tasks);
        
        // store task data in local variable
        task = table.children[oldVal], data = tasks[keys[0]][oldVal];
        
        // change the selected index of all affected tasks between the initial and final position
        for (var i = newVal; i * dir < oldVal * dir; i += dir) {
            table.children[i].firstChild.firstChild.selectedIndex += dir;
        }
        
        // edit storage data array
        tasks[keys[0]].splice(oldVal, 1);
        tasks[keys[0]].splice(newVal, 0, data);
        chrome.storage.sync.set(tasks);
        
        // remove task at initial position
        table.removeChild(task);

        // insert task from local variable
        var inserted = table.insertBefore(task, table.children[newVal]);

        // add css glow to indicate insertion
        inserted.classList.remove("glow");
        inserted.classList.add("glow");
        
        save(task);
    });
    
    // prevent incorrect deletion of alarm
    if (type == "complete") {
        return 0;
    }
    
    var current, next, time, index = 0;
    
    // replace each old alarm with the one above it
    for (var i = (oldVal - dir); i * dir > newVal * dir; i -= dir) {
        for (var j = 0; j < pings.length; j += 1) {
            current = i + " " + pings[j], next = (i - dir) + " " + pings[j];
            shift(current, next);
        }
    }
    
    // set alarm data of inserted task
    for (var i = 0; i < pings.length; i += 1) {
        next = oldVal + " " + pings[i];
        chrome.alarms.get(next, function (alarm) {
            current = newVal + " " + pings[index];
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
        current = oldVal + " " + pings[i], next = (oldVal - dir) + " " + pings[i];
        shift(current, next);
    }
}

// log the storage and alarms to the console
function log() {
    chrome.storage.sync.get(null, function (data) { console.log(data); });
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
function newTask(action, index, desc, dt, t, ch) {
    var listO = document.getElementById("ongoing"), listC = document.getElementById("complete");
    var options = "", type, table, posClass;
    var task = document.createElement("tr");
    var priority, description, date, time, check, del;
    var row = [priority, description, date, time, check, del];
    
    // create td template
    for (td in row) {
        row[td] = document.createElement("td");
    }
    
    // define undefined values
    function define(variable) {
        if (variable === undefined) {
            return "";
        }
        return variable;
    }
    desc = define(desc), ch = define(ch), dt = define(dt), t = define(t);
    
    // add appropriate html tags with input from chrome storage
    row[1].innerHTML = '<input placeholder="Task" type="text" maxlength="48" autocomplete="off" value="' + desc + '">';
    row[2].innerHTML = "<input type='date' value='" + dt + "'>"
    row[3].innerHTML = "<input type='time' value='" + t + "'>"
    row[4].innerHTML = "<input type='checkbox'" + ch + ">";
    row[5].innerHTML = "<button class='delete' style='padding: none'><img src='images/delete.png' draggable='false'></button>";
    
    // create all position options from chrome storage
    if (ch == "checked") {
        type = "complete";
        table = document.getElementById("complete");
        position = document.getElementsByClassName("posC");
        posClass = "posC";
    } else {
        type = "ongoing";
        table = document.getElementById("ongoing");
        position = document.getElementsByClassName("posO");
        posClass = "posO";
    }

    // add new position option to existing tasks
    for (var i = 0; i < position.length; i += 1) {
        position[i].innerHTML += "<option value='" + (position.length + 1) + "'>" + (position.length + 1) + "</option>";
    }
    
    // create priority ranking select
    chrome.storage.sync.get(type, function (tasks) {
        var keys = Object.keys(tasks);

        // create an option for each existing task position
        for (var i = 1; i <= tasks[keys[0]].length; i += 1) {
            options += "<option value='" + i + "'>" + i + "</option>";
        }
        
        // completes the select tag
        row[0].innerHTML = "<select class='" + posClass + "'>" + options + "</select>";
        
        // if it is a new or first task, an option is created, otherwise, selects the index of the position in table
        if (index === undefined || options == "") {
            row[0].firstChild.innerHTML += "<option selected value='" + (tasks[keys[0]].length + 1) + "'>" + (tasks[keys[0]].length + 1) + "</option>";
        } else {
            row[0].firstChild.selectedIndex = index - 1;
        }
        
        // if the task is new, it is stored
        if (index === undefined) {
            tasks[keys[0]].push([desc, dt, t]);
            chrome.storage.sync.set(tasks);
            
            // expand accordion if closed
            if (!table.previousElementSibling.classList.contains("active")) {
                table.previousElementSibling.classList.toggle("active");
            }
            table.style.maxHeight = table.scrollHeight + "px";
            
            count();
        }
    });

    // adds all data to the full task row string and adds it to the table
    for (var i = 0; i < row.length; i += 1) {
        task.append(row[i]);
    }
    table.append(task);
    
    // if unchecked, recreates the alarm for the notification
    if (dt !== "" && t !== "" && ch !== "checked") {
        reschedule(position.length);
    }
    
    // add event listeners to all inputs
    row[0].addEventListener("change", insert);
    row[1].addEventListener("input", sync);
    row[2].addEventListener("change", function (e) {
        sync(e);
        reschedule(row[0].firstChild.selectedIndex);
    });
    row[3].addEventListener("change", function (e) {
        sync(e);
        reschedule(row[0].firstChild.selectedIndex);
    });
    row[4].addEventListener("change", function () {
        save(task, true);
        // play sound effect when a task is checked off
        if (task.children[4].firstChild.checked === true && !muted) {
            var audio = new Audio("audio/ding.mp3");
            audio.play();
        }
    });
    row[5].addEventListener("click", function (e) {
        remove(e.currentTarget.parentElement);
    });
    
    // reorganize all selects
    for (var i = 0; i < position.length; i += 1) {
        position[i].selectedIndex = i;
    }
}

// remove task from table and chrome storage
function remove(task, clicked) {
    // initiate variables
    var create = document.getElementById("create"), listC = document.getElementById("complete"), listO = document.getElementById("ongoing");
    var table, type;
    
    if (!muted && !clicked) {
        var audio = new Audio("audio/trash.mp3");
        audio.play();
    }
    
    // determine which table to remove the task from
    if ((task.children[4].firstChild.checked && !clicked) || (!task.children[4].firstChild.checked && clicked)) {
        type = "complete";
        table = listC;
    } else {
        type = "ongoing";
        table = listO;
    }
    var index = task.firstChild.firstChild.selectedIndex;
    table.removeChild(task);
    
    count();
    
    // delete task from chrome storage
    chrome.storage.sync.get(type, function (tasks) {
        var keys = Object.keys(tasks);
        
        // decrease the selected index of all tasks above the deleted task
        for (var i = table.children.length - 1; i >= index; i -= 1) {
            table.children[i].firstChild.firstChild.selectedIndex -= 1;
        }

        // delete the last option from all selects
        for (var i = 0; i < table.children.length; i += 1) {
            table.children[i].firstChild.firstChild.removeChild(table.children[i].firstChild.firstChild.lastChild);
        }
        
        tasks[keys[0]].splice(index, 1);
        chrome.storage.sync.set(tasks);
    });
    
    // prevent incorrect deletion of alarm
    if (table == listC) {
        return 0;
    }
    
    // delete alarm
    var current, next, last;
    
    // replace each old alarm with the one above it
    for (var i = index; i < listO.children.length; i += 1) {
        for (var j = 0; j < pings.length; j += 1) {
            current = i + " " + pings[j], next = (i + 1) + " " + pings[j];
            shift(current, next);
        }
    }
    
    // delete the alarms related to the last task
    for (var i = 0; i < pings.length; i += 1) {
        last = listO.children.length + " " + pings[i];
        chrome.alarms.clear(last);
    }
    
    // resize table
    table.style.maxHeight = table.scrollHeight + "px";
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
    var index, time, date, task = document.getElementById("ongoing").children[key];
    
    for (var i = 0; i < pings.length; i += 1) {
        index = key + " " + pings[i];
        time = new Date(task.children[2].firstChild.value + "T" + task.children[3].firstChild.value + "Z").getTime() - (pings[i] - today.getTimezoneOffset()) * 60 * 1000;
        
        if (time > today.getTime()) {
            chrome.alarms.create(index, {when: time});
        } else {
            chrome.alarms.clear(index);
        }
    }
}

// save data to chrome storage
function save(parent, checked) {
    var task = [], index = Array.prototype.indexOf.call(parent.parentElement.children, parent), type, checkbox;
    
    // add each task data value to the task array
    for (var j = 1; j < parent.childElementCount - 2; j += 1) {
        task.push(parent.children[j].firstChild.value);
    }
    
    // determine key to read and write data
    if (parent.children[j].firstChild.checked) {
        type = "complete";
        checkbox = "checked";
    } else {
        type = "ongoing";
        checkbox = "";
    }
    
    chrome.storage.sync.get(type, function (tasks) {
        var keys = Object.keys(tasks);
        
        // create new task
        if (checked) {
            newTask(null, undefined, task[0], task[1], task[2], checkbox);
            remove(parent, true);
            return 0;
        }
        
        tasks[keys[0]][index] = task;
        chrome.storage.sync.set(tasks);
    });
}

// schedule new notification times
function schedule() {
    var alarms = [], name, date, time;
    var checked = document.getElementsByClassName("prefire"), tasks = document.getElementById("ongoing").children, notif = document.getElementById("notif");
    
    chrome.alarms.clearAll();
    
    // add alarms
    for (var i = 0; i < checked.length; i += 1) {
        if (checked[i].checked) {
            alarms.push(checked[i].value);
            for (var j = 0; j < tasks.length; j += 1) {
                name = j + " " + checked[i].value;
                time = new Date(tasks[j].children[2].firstChild.value + "T" + tasks[j].children[3].firstChild.value + "Z").getTime() - (checked[i].value - today.getTimezoneOffset()) * 60 * 1000;
                
                if (time > today.getTime()) {
                    chrome.alarms.create(name, {when: time});
                }
            }
        }
    }
    
    // toggle notification icon
    if ((alarms.length && !pings.length) || (pings.length && !alarms.length)) {
        notif.firstChild.classList.toggle("fa-bell-o");
        notif.firstChild.classList.toggle("fa-bell-slash-o");
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
function sound(click) {
    var mute = document.getElementById("mute"), entry = {};
    
    // toggle muted boolean
    muted = !muted;
    mute.firstChild.classList.toggle("fa-volume-up"), mute.firstChild.classList.toggle("fa-volume-off");
    
    // change tooltip
    if (muted) {
        mute.title = "Unmute";
    } else {
        mute.title = "Mute";
    }
    
    if (click) {
        entry["muted"] = muted;
        chrome.storage.sync.set(entry);
    }
}

// prevent autosaving too quickly
function sync(input, checked) {
    var parent = input.currentTarget.parentElement;
    clearInterval(timer);
    var timer = setTimeout(function() {save(parent, checked);}, 500);
}