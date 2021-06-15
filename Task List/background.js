// when alarm goes off, send a notification to the user
chrome.alarms.onAlarm.addListener(function(alarm) {
    // get notification data from storage
    chrome.storage.sync.get("ongoing", function (ongoing) {
        var title = ongoing["ongoing"][alarm.name.split("/")[0]][1];
        var options = {
            type: "basic",
            icon: "images/tasklist.png",
            body: "In " + alarm.name.split(" ")[1] + " minutes",
            priority: 2
        }
        self.registration.showNotification(title, options);
    });
});