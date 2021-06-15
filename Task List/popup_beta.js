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
    var oldVal = Array.prototype.indexOf.call(option.currentTarget.parentElement.parentElement.children, option.currentTarget.parentElement), newVal = option.currentTarget.firstChild.selectedIndex, dir = 1;
    
    // change the direction of the for loop to save correctly
    if (newVal >= oldVal) {
        dir = -1;
    }
    
    if (option.currentTarget.parentElement.children[4].firstChild.checked) {
        type = "complete";
        table = document.getElementById("complete");
        positions = document.getElementsByClassName("posC");
    } else {
        type = "ongoing";
        table = document.getElementById("ongoing");
        positions = document.getElementsByClassName("posO");
    }
    stored[type] = type;
    
    chrome.storage.sync.get(stored, function (tasks) {
        var keys = Object.keys(tasks);
        
        // change the selected index of all affected tasks between the initial and final position
        for (var i = newVal; i * dir < oldVal * dir; i += dir) {
            table.children[i].firstChild.firstChild.selectedIndex += dir;

            // add each task data value to the task array
            task = [];
            for (var j = 1; j < table.children[i].childElementCount - 2; j += 1) {
                task.push(table.children[i].children[j].firstChild.value);
            }
            tasks[keys[0]][i + dir] = task;
        }
        entry[keys[0]] = tasks[keys[0]];
        chrome.storage.sync.set(entry);
        
        // store task data in local variable
        task = table.children[oldVal];

        // remove task at initial position
        table.removeChild(table.children[oldVal]);

        // insert task from local variable
        var inserted = table.insertBefore(task, table.children[newVal]);

        // save inserted task to chrome storage
        save(task);

        // add css glow to indicate insertion
        inserted.classList.remove("glow");
        inserted.classList.add("glow");
    });
    
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
    chrome.storage.sync.get(null, function (data) {
        console.log(data);
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
function newTask(action, index, desc, dt, t, ch) {
    // initiate variables
    var task = document.createElement("tr");
    var listO = document.getElementById("ongoing"), listC = document.getElementById("complete"), posO = document.getElementsByClassName("posO"), posC = document.getElementsByClassName("posC");
    var options = "", entry = {}, stored = {}, type, table, position, posClass;
    var priority, description, month, day, check, del;
    
    // create td template
    priority = document.createElement("td"), description = document.createElement("td"), date = document.createElement("td"), time = document.createElement("td"), check = document.createElement("td"), del = document.createElement("td");
    
    // define undefined values
    function define(variable) {
        if (variable === undefined) {
            return "";
        }
        return variable;
    }
    desc = define(desc), ch = define(ch), dt = define(dt), t = define(t);
    
    // add appropriate html tags with input from chrome storage
    description.innerHTML = '<input placeholder="Task" type="text" maxlength="48" autocomplete="off" value="' + desc + '">';
    date.innerHTML = "<input type='date' value='" + dt + "'>"
    time.innerHTML = "<input type='time' value='" + t + "'>"
    check.innerHTML = "<input type='checkbox'" + ch + ">";
    del.innerHTML = "<button class='delete' style='padding: none'><img src='images/delete.png' draggable='false' style='width: 16px; margin: none'></button>";
    
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

        // if index is not passed in as an argument, stores the task
        if (index === undefined) {
            var data = [desc, dt, t];
            tasks[keys[0]].push(data);
            
            // submits the data to chrome storage
            entry[keys[0]] = tasks[keys[0]];
            chrome.storage.sync.set(entry);
            
            // expand accordion if closed
            if (!table.previousElementSibling.classList.contains("active")) {
                table.previousElementSibling.classList.toggle("active");
            }
            table.style.maxHeight = table.scrollHeight + "px";
        }
    });

    // puts all task data into an array
    var row = [priority, description, date, time, check, del];

    // adds all data to the full task row string
    for (var i = 0; i < row.length; i += 1) {
        task.append(row[i]);
    }
    // creates the html row in the table
    table.append(task);
    
    if (dt !== "" && t !== "" && ch !== "checked") {
        reschedule(posO.length);
    }
    
    // adds event listeners to all inputs to autosave
    priority.addEventListener("change", insert);
    description.addEventListener("input", sync);
    date.addEventListener("change", function (e) {
        sync(e);
        reschedule(priority.firstChild.selectedIndex);
    });
    time.addEventListener("change", function (e) {
        sync(e);
        reschedule(priority.firstChild.selectedIndex);
    });
    check.addEventListener("change", function () {
        save(task, true);
        // play sound when a task is checked off
        if (task.children[4].firstChild.checked === true && !muted) {
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
    
    // reorganize all selects
    for (var i = 0; i < posO.length; i += 1) {
        posO[i].selectedIndex = i;
    }
    count();
}

// remove task from table and chrome storage
function remove(target, parent, clicked) {
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
    if (listO.children.length + listC.children.length == 100) {
        create.style.display = "block";
        create.addEventListener("click", newTask);
    }
    
    if ((task.children[4].firstChild.checked && !clicked) || (!task.children[4].firstChild.checked && clicked)) {
        type = "complete";
        table = listC;
        position = document.getElementsByClassName("posC");
    } else {
        type = "ongoing";
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
        for (var i = table.children.length - 1; i >= end; i -= 1) {
            table.children[i].firstChild.firstChild.selectedIndex -= 1;

            // add each task data value to the task array
            task = [];
            for (var j = 1; j < table.children[i].childElementCount - 2; j += 1) {
                task.push(table.children[i].children[j].firstChild.value);
            }
            tasks[keys[0]][i] = task;
        }

        tasks[keys[0]].pop();
        entry[keys[0]] = tasks[keys[0]];
        chrome.storage.sync.set(entry);

        // delete the last option from all selects
        for (var i = 0; i < table.children.length; i += 1) {
            table.children[i].firstChild.firstChild.removeChild(table.children[i].firstChild.firstChild.lastChild);
        }
    });
    
    // prevent incorrect deletion of alarm
    if (table == listC) {
        return 0;
    }
    
    // delete alarm
    var current, next, last;
    
    // replace each old alarm with the one above it
    for (var i = end; i < listO.children.length; i += 1) {
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
    var task = [], entry = {}, stored = {}, index = Array.prototype.indexOf.call(parent.parentElement.children, parent), type, checkbox;
    
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
    stored[type] = type;
    
    chrome.storage.sync.get(stored, function (tasks) {
        var keys = Object.keys(tasks);
        
        if (checked) {
            newTask(null, undefined, task[0], task[1], task[2], checkbox);
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
    var parent = input.currentTarget.parentElement;
    
    // clear the timer
    clearInterval(timer);
    
    // create the timer
    var timer = setTimeout(function() {save(parent, checked);}, 500);
}