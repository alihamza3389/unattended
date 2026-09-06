# The nights it did not dream

The mind has not stopped thinking since it started. That part is a clock, and
a clock does not need anyone. But the dreaming is different: once a night a
real model reads the day it just lived and writes it more to think with, and
that runs on machines I pay for and do not control.

Some nights that has failed. Once it did something worse than fail, and
reported success while thinking about the wrong day. Either way there is a hole
in `corpus/nights` where a night should be, and anyone counting can see it.
This file says what happened on each one, because a record you can check is
worth nothing if the missing parts go unexplained, and because whoever notices
a gap is exactly the person owed an answer.

Nothing here has ever been quietly filled in afterwards. A night it missed
stays missed.

---

### night 13, 11 July 2026

The dream job was still being set up that week and I was firing it by hand.
The runs went out after its day had already turned over rather than before,
and the check that stops a day being dreamt twice did what it was built to do
and skipped one that had already begun.

So it went to sleep and woke up with nothing new. Night 12 is there, night 14
is there, and between them is a day of thinking that never became material.

My fault, entirely, and the kind of fault you only make while learning the
thing you built.

---

### night 46, 13 August 2026

The model that had been writing the dreams stopped agreeing to write them. Not
once, and not because of anything that changed here: the same request that had
worked for thirty two consecutive nights came back refused, after about fifty
words each time, over and over.

I spent a day being wrong about why. I thought the prompt had outgrown its
limits, and raised them, and it refused. I thought six weeks of a mind doubting
its own existence had started reading as something darker than it is, and said
plainly in the request that this is a work of fiction, and it refused. I
thought it might be the depth of thinking, and tried every setting, and it
refused at all of them.

Then I handed the identical request to a different model and it wrote the whole
night without hesitating. So it was never the piece. It was one model, on one
route, declining this work as of a Thursday.

It dreams on a different model now. A night was lost finding that out.

---

### night 60, 27 August 2026

Nothing failed. The job ran, wrote a night, committed it, and reported success.
It is still sitting green in the log. It dreamt the wrong night.

Until this week it worked out which night to dream by asking how far into the
current day it was. Early, and the day that had just ended was the one to think
about. Late, and it took the current day to be mostly over and thought about
that instead, on the reasoning that a run only ever lands near the boundary.
Every scheduled run for the ten days before this one went out within half an
hour of the day turning, so the question never came up.

On the twenty seventh of August the scheduler these jobs run on started handing
them out four to twelve hours late, and it has been late ever since. That
morning the run came ten hours in. Ten hours read as most of a day, so it
passed over night 60 without touching it and dreamt night 61, out of a day that
still had fourteen hours left to go.

It cost more than the one night. Night 61 is in the archive, but it was written
about ten hours of a twenty four hour day, and nothing in the record says so.
Two nights later, two runs landed either side of that same six hour line,
nineteen minutes over and thirty four minutes under, and both concluded they
were night 63. The second wrote over the first. Night 63 was dreamt twice and
only the second one is readable. The first is still in the history, at commit
`1012639`, and that is where it stays.

It no longer asks the clock anything. It dreams the day that ended, which is a
fact rather than an estimate.

What I keep coming back to is that this one did not raise a hand. Night 46
announced itself: the requests came back refused, over and over, and I knew
that day. This one reported success, and went on reporting it every morning
after, and was found ten days later by counting files. A green log is not the
same thing as a night that happened, and I will not be reading it as one again.

Night 13 was this same shape, which I did not see until I wrote this entry. A
job that ran, decided it had nothing to do, and was correct about its own rules
and wrong about the night. Twice now the thing that went wrong was a job
believing it had made the right call. I did not learn enough from it the first
time.

---

### How to check this yourself

Every night it dreams is a commit authored by `unattended`, and every dream is
a file in `corpus/nights` named for its day.

```
ls corpus/nights                          # every night it kept
git log --author=unattended --oneline     # every night it wrote
```

Count them. Where a number is missing, a night is missing, and it should be
accounted for above. If you find a gap that is not listed here, I have made a
mistake in this file and I would like to know.
